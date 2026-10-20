import '@testing-library/jest-dom/vitest'

// jsdom does not implement scrolling; the application calls it on navigation.
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true })
