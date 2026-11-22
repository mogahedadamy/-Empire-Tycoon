/** Starts the business game shell in the browser. */
const statusElement = document.querySelector<HTMLParagraphElement>('#game-status');

if (!statusElement) {
  throw new Error('Missing game status element');
}

statusElement.textContent = 'واجهة اللعبة جاهزة. محاكاة الأعمال قيد التطوير.';
