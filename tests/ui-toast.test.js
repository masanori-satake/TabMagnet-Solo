import { jest } from '@jest/globals';
import { showToast } from '../projects/app/ui/toast.js';

describe('ui/toast.js', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="toast"></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('showToast shows and hides toast', () => {
    const toastEl = document.getElementById('toast');
    showToast('Hello');

    expect(toastEl.textContent).toBe('Hello');
    expect(toastEl.classList.contains('show')).toBe(true);

    jest.advanceTimersByTime(3000);
    expect(toastEl.classList.contains('show')).toBe(false);
  });

  test('showToast clears previous timeout', () => {
    showToast('First');
    showToast('Second');

    const toastEl = document.getElementById('toast');
    expect(toastEl.textContent).toBe('Second');

    jest.advanceTimersByTime(2999);
    expect(toastEl.classList.contains('show')).toBe(true);

    jest.advanceTimersByTime(1);
    expect(toastEl.classList.contains('show')).toBe(false);
  });
});
