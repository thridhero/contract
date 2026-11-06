<template>
  <div
    v-if="renderAsMarkdown"
    class="ai-message-markdown break-words text-sm leading-6"
    v-html="sanitizedMarkdownHtml"
  />
  <div v-else class="whitespace-pre-wrap break-words text-sm leading-6">{{ content }}</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import type { AIAgentMessageRole } from '../../../../shared/types/aiAgent.types'

const props = defineProps<{
  role: AIAgentMessageRole
  content: string
}>()

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
})

const defaultLinkOpenRenderer =
  markdown.renderer.rules.link_open ??
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const targetIndex = token.attrIndex('target')
  const relIndex = token.attrIndex('rel')

  if (targetIndex < 0) {
    token.attrPush(['target', '_blank'])
  } else {
    token.attrs![targetIndex][1] = '_blank'
  }

  if (relIndex < 0) {
    token.attrPush(['rel', 'noopener noreferrer nofollow'])
  } else {
    token.attrs![relIndex][1] = 'noopener noreferrer nofollow'
  }

  return defaultLinkOpenRenderer(tokens, idx, options, env, self)
}

const renderAsMarkdown = computed(() => props.role === 'assistant')

const sanitizedMarkdownHtml = computed(() => {
  if (!renderAsMarkdown.value || !props.content) {
    return ''
  }

  const renderedHtml = markdown.render(props.content)
  return DOMPurify.sanitize(renderedHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  })
})
</script>

<style scoped>
.ai-message-markdown {
  color: inherit;
}

.ai-message-markdown :deep(p:first-child),
.ai-message-markdown :deep(ul:first-child),
.ai-message-markdown :deep(ol:first-child),
.ai-message-markdown :deep(pre:first-child),
.ai-message-markdown :deep(blockquote:first-child),
.ai-message-markdown :deep(table:first-child) {
  margin-top: 0;
}

.ai-message-markdown :deep(p:last-child),
.ai-message-markdown :deep(ul:last-child),
.ai-message-markdown :deep(ol:last-child),
.ai-message-markdown :deep(pre:last-child),
.ai-message-markdown :deep(blockquote:last-child),
.ai-message-markdown :deep(table:last-child) {
  margin-bottom: 0;
}

.ai-message-markdown :deep(p) {
  margin: 0.75rem 0;
}

.ai-message-markdown :deep(ul),
.ai-message-markdown :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.5rem;
}

.ai-message-markdown :deep(li + li) {
  margin-top: 0.25rem;
}

.ai-message-markdown :deep(a) {
  color: var(--btn-primary-bg);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ai-message-markdown :deep(blockquote) {
  margin: 0.75rem 0;
  padding-left: 0.875rem;
  border-left: 3px solid var(--content-border);
  color: var(--content-text-muted);
}

.ai-message-markdown :deep(code) {
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 0.875em;
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  background: color-mix(in srgb, var(--content-border) 28%, transparent);
}

.ai-message-markdown :deep(pre) {
  margin: 0.75rem 0;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--content-border);
  background: color-mix(in srgb, var(--content-bg) 88%, black 12%);
  overflow-x: auto;
}

.ai-message-markdown :deep(pre code) {
  padding: 0;
  background: transparent;
}

.ai-message-markdown :deep(hr) {
  margin: 1rem 0;
  border: none;
  border-top: 1px solid var(--content-border);
}

.ai-message-markdown :deep(table) {
  width: 100%;
  margin: 0.75rem 0;
  border-collapse: collapse;
}

.ai-message-markdown :deep(th),
.ai-message-markdown :deep(td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--content-border);
  text-align: left;
  vertical-align: top;
}

.ai-message-markdown :deep(th) {
  background: color-mix(in srgb, var(--content-border) 18%, transparent);
}
</style>
