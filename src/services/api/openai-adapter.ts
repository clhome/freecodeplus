/**
 * OpenAI Compatibility Adapter for Anthropic SDK
 *
 * Implements a fetch interception layer to translate Anthropic SDK requests
 * into standard OpenAI Chat Completions requests, enabling usage with
 * third-party OpenAI-compatible endpoints.
 */

import { randomUUID } from 'crypto'

export interface AnthropicContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string | AnthropicContentBlock[]
  source?: {
    type: string
    media_type: string
    data: string
  }
}

export interface AnthropicMessage {
  role: string
  content: string | AnthropicContentBlock[]
}

/**
 * Translates Anthropic messages into OpenAI-compatible chat messages
 */
function translateMessagesToOpenAI(messages: AnthropicMessage[], system?: string | any[]): any[] {
  const openAIMessages: any[] = []

  // Add system message if present
  if (system) {
    let systemText = ''
    if (typeof system === 'string') {
      systemText = system
    } else if (Array.isArray(system)) {
      systemText = system
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
    }
    if (systemText) {
      openAIMessages.push({ role: 'system', content: systemText })
    }
  }

  // Iterate over messages
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      openAIMessages.push({ role: msg.role, content: msg.content })
      continue
    }

    if (Array.isArray(msg.content)) {
      const toolCalls: any[] = []
      const contentParts: any[] = []

      for (const block of msg.content) {
        if (block.type === 'text') {
          contentParts.push({ type: 'text', text: block.text })
        } else if (block.type === 'image' && block.source) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${block.source.media_type};base64,${block.source.data}`
            }
          })
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input || {})
            }
          })
        } else if (block.type === 'tool_result') {
          let outputText = ''
          if (typeof block.content === 'string') {
            outputText = block.content
          } else if (Array.isArray(block.content)) {
            outputText = block.content
              .map(c => (c.type === 'text' ? c.text : '[Media]'))
              .join('\n')
          }
          openAIMessages.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: outputText || ''
          })
        }
      }

      // If this was an assistant message with tool calls, combine them
      if (msg.role === 'assistant') {
        const assistantMsg: any = { role: 'assistant' }
        if (contentParts.length > 0) {
          assistantMsg.content = contentParts[0].text // Simple text for assistant usually
        }
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls
        }
        openAIMessages.push(assistantMsg)
      } else if (msg.role === 'user' && contentParts.length > 0) {
        openAIMessages.push({ role: 'user', content: contentParts })
      }
    }
  }

  return openAIMessages
}

/**
 * Creates an Anthropic-formatted SSE event
 */
function formatAnthropicSSE(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * Translates OpenAI stream chunks to Anthropic message deltas
 */
async function translateOpenAIStreamToAnthropic(
  openAIResponse: Response,
  model: string,
  messageId: string
): Promise<Response> {
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      let contentBlockIndex = 0
      let inputTokens = 0
      let outputTokens = 0

      // Initial Message Start
      controller.enqueue(encoder.encode(formatAnthropicSSE('message_start', {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      })))

      // Simple first content block start
      controller.enqueue(encoder.encode(formatAnthropicSSE('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' }
      })))

      const reader = openAIResponse.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const dataStr = trimmed.slice(6)
          if (dataStr === '[DONE]') continue

          try {
            const chunk = JSON.parse(dataStr)
            const delta = chunk.choices?.[0]?.delta

            if (delta?.content) {
              controller.enqueue(encoder.encode(formatAnthropicSSE('content_block_delta', {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: delta.content }
              })))
              outputTokens++
            }

            if (delta?.tool_calls) {
              // Note: Complex tool call handling for streaming would go here
              // For now we focus on basic text compatibility
            }
          } catch (e) {
            // Ignore parse errors from partial chunks
          }
        }
      }

      // Close message
      controller.enqueue(encoder.encode(formatAnthropicSSE('content_block_stop', {
        type: 'content_block_stop',
        index: 0
      })))

      controller.enqueue(encoder.encode(formatAnthropicSSE('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: outputTokens }
      })))

      controller.enqueue(encoder.encode(formatAnthropicSSE('message_stop', {
        type: 'message_stop',
        usage: { input_tokens: 0, output_tokens: outputTokens }
      })))

      controller.close()
    }
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream' }
  })
}

/**
 * Main interceptor function
 */
export async function handleOpenAICompatRequest(
  url: string,
  init: RequestInit,
  innerFetch: typeof globalThis.fetch
): Promise<Response> {
  const anthropicBody = JSON.parse(init.body as string)
  const messageId = `msg_compat_${randomUUID()}`

  const openAIBody = {
    model: anthropicBody.model,
    messages: translateMessagesToOpenAI(anthropicBody.messages, anthropicBody.system),
    stream: true,
    max_tokens: anthropicBody.max_tokens,
    temperature: anthropicBody.temperature,
    tools: anthropicBody.tools?.map((t: any) => {
      // Deep clone to avoid mutating original
      const parameters = JSON.parse(JSON.stringify(t.input_schema || { type: 'object', properties: {} }));
      
      // Recursive function to remove unsupported fields from JSON schema
      const sanitizeSchema = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        // Fields known to cause 400 errors on some strict OpenAI/Gemini endpoints
        const forbidden = ['additionalProperties', 'propertyNames', 'exclusiveMinimum', 'const'];
        for (const key of forbidden) {
          delete obj[key];
        }
        
        // Recurse into properties and items
        if (obj.properties) {
          for (const prop in obj.properties) sanitizeSchema(obj.properties[prop]);
        }
        if (obj.items) sanitizeSchema(obj.items);
        if (Array.isArray(obj.anyOf)) obj.anyOf.forEach(sanitizeSchema);
        if (Array.isArray(obj.allOf)) obj.allOf.forEach(sanitizeSchema);
        if (Array.isArray(obj.oneOf)) obj.oneOf.forEach(sanitizeSchema);
      };
      
      sanitizeSchema(parameters);

      return {
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: parameters
        }
      };
    })
  }

  // Construct the OpenAI URL (replace host and path)
  const baseUrl = process.env.ANTHROPIC_BASE_URL || ''
  const openAIUrl = baseUrl.endsWith('/v1') 
    ? `${baseUrl}/chat/completions` 
    : baseUrl.includes('/v1') 
      ? baseUrl.replace('/v1/messages', '/v1/chat/completions')
      : `${baseUrl}/v1/chat/completions`

  const headers = new Headers(init.headers);
  // Ensure Authorization is present, prioritize what's in init.headers, 
  // fallback to env if missing
  if (!headers.has('Authorization') && process.env.ANTHROPIC_API_KEY) {
    headers.set('Authorization', `Bearer ${process.env.ANTHROPIC_API_KEY}`);
  }

  const response = await innerFetch(openAIUrl, {
    ...init,
    headers,
    body: JSON.stringify(openAIBody)
  })

  if (!response.ok) return response

  return translateOpenAIStreamToAnthropic(response, anthropicBody.model, messageId)
}
