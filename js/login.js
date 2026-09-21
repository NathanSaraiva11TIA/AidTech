document.querySelectorAll('.login-toggle-pass').forEach(function (btn) {
  btn.addEventListener('click', function () {
    const input = btn.previousElementSibling;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.classList.toggle('is-visible', isHidden);
  });
});

const checkbox = document.querySelector('.login-checkbox input');
const submitBtn = document.querySelector('.login-submit');
if (checkbox && submitBtn) {
  submitBtn.addEventListener('click', function (e) {
    if (!checkbox.checked) {
      e.preventDefault();
      checkbox.focus();
    }
  });
}
