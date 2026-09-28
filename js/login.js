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
const form = document.querySelector('.login-form-wrap form');

if (checkbox && submitBtn) {
  submitBtn.addEventListener('click', function (e) {
    if (!checkbox.checked) {
      e.preventDefault();
      checkbox.focus();
    } else if (form) {
      e.preventDefault();
      const nameInput = form.querySelector('input[placeholder*="Nome"]') || form.querySelector('input[type="text"]');
      const emailInput = form.querySelector('input[type="email"]');
      if (nameInput && emailInput && nameInput.value && emailInput.value) {
        localStorage.setItem('agrosense_user', JSON.stringify({
          name: nameInput.value,
          email: emailInput.value,
          loginTime: new Date().toISOString()
        }));
        window.location.href = 'index.html';
      }
    }
  });
}
