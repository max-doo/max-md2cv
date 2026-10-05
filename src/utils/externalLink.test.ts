import { describe, expect, it, vi } from 'vitest'
import { isExternalUrl, setupExternalLinkHandler } from './externalLink'

describe('isExternalUrl', () => {
  it('identifies external http and https urls', () => {
    expect(isExternalUrl('https://github.com/max-doo/max-md2cv')).toBe(true)
    expect(isExternalUrl('http://example.com')).toBe(true)
    expect(isExternalUrl('https://vuejs.org/guide/introduction.html')).toBe(true)
    expect(isExternalUrl('https://myportfolio.com?user=1#about')).toBe(true)
  })

  it('identifies mailto and tel urls', () => {
    expect(isExternalUrl('mailto:test@example.com')).toBe(true)
    expect(isExternalUrl('mailto:user@domain.com?subject=Hello')).toBe(true)
    expect(isExternalUrl('tel:13800000000')).toBe(true)
    expect(isExternalUrl('tel:+86-138-0000-0000')).toBe(true)
  })

  it('rejects internal anchors, relative paths, and non-http schemes', () => {
    expect(isExternalUrl('#section-1')).toBe(false)
    expect(isExternalUrl('#')).toBe(false)
    expect(isExternalUrl('javascript:void(0)')).toBe(false)
    expect(isExternalUrl('data:text/plain;base64,SGVsbG8=')).toBe(false)
    expect(isExternalUrl('blob:http://localhost/uuid')).toBe(false)
    expect(isExternalUrl('/index.html')).toBe(false)
    expect(isExternalUrl('./relative/file.md')).toBe(false)
    expect(isExternalUrl('')).toBe(false)
    expect(isExternalUrl(null)).toBe(false)
    expect(isExternalUrl(undefined)).toBe(false)
  })

  it('rejects localhost, 127.0.0.1, and tauri.localhost hostnames', () => {
    expect(isExternalUrl('http://localhost:18080')).toBe(false)
    expect(isExternalUrl('http://localhost:5173/page')).toBe(false)
    expect(isExternalUrl('http://127.0.0.1:18080/index.html')).toBe(false)
    expect(isExternalUrl('http://tauri.localhost/index.html')).toBe(false)
    expect(isExternalUrl('https://tauri.localhost/assets/logo.png')).toBe(false)
  })
})

describe('setupExternalLinkHandler', () => {
  class MockMouseEvent extends Event {
    button = 0
    target: any

    constructor(type: string, options: { button?: number; target?: any } = {}) {
      super(type, { bubbles: true, cancelable: true })
      this.button = options.button ?? 0
      this.target = options.target ?? null
    }
  }

  it('intercepts click on external links and prevents default', () => {
    const mockAnchor = {
      getAttribute: (name: string) => (name === 'href' ? 'https://github.com/max-doo/max-md2cv' : null),
    }

    const target = Object.assign(new EventTarget(), {
      closest: (selector: string) => (selector === 'a' ? mockAnchor : null),
    })
    const cleanup = setupExternalLinkHandler(target)

    const event = new MockMouseEvent('click', {
      button: 0,
      target: {
        closest: (selector: string) => (selector === 'a' ? mockAnchor : null),
      },
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')

    target.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(stopPropagationSpy).toHaveBeenCalled()

    cleanup()
  })

  it('does not intercept internal anchor links', () => {
    const target = new EventTarget()
    const cleanup = setupExternalLinkHandler(target)

    const mockAnchor = {
      getAttribute: (name: string) => (name === 'href' ? '#education' : null),
    }

    const event = new MockMouseEvent('click', {
      button: 0,
      target: {
        closest: (selector: string) => (selector === 'a' ? mockAnchor : null),
      },
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    target.dispatchEvent(event)

    expect(preventDefaultSpy).not.toHaveBeenCalled()

    cleanup()
  })

  it('ignores clicks without anchor tags', () => {
    const target = new EventTarget()
    const cleanup = setupExternalLinkHandler(target)

    const event = new MockMouseEvent('click', {
      button: 0,
      target: {
        closest: () => null,
      },
    })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    target.dispatchEvent(event)

    expect(preventDefaultSpy).not.toHaveBeenCalled()

    cleanup()
  })
})
