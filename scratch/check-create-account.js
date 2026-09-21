const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
const js = fs.readFileSync('js/app.js', 'utf8');

console.log('--- Verifying HTML ---');
console.log('Create account heading:', html.includes('Create account'));
console.log('Aadhaar/Passport placeholder:', html.includes('placeholder="Enter Name as per Aadhaar/Passport"'));
console.log('WhatsApp placeholder:', html.includes('placeholder="Enter your phone number as WhatsApp"'));
console.log('Centered SUBMIT button:', html.includes('auth-btn-submit-centered'));

console.log('\n--- Verifying CSS ---');
console.log('auth-card-top-create pastel yellow #FEF7CD:', css.includes('#FEF7CD'));
console.log('auth-btn-submit-centered defined:', css.includes('.auth-btn-submit-centered'));
console.log('Button light gray #F1F3F5:', css.includes('#F1F3F5'));

console.log('\n--- Verifying JS ---');
console.log('goToAuthScreen(3) present:', js.includes('goToAuthScreen(3)'));
console.log('Name validation Aadhaar/Passport:', js.includes('Aadhaar/Passport'));
console.log('Phone validation 10-digit WhatsApp:', js.includes('10-digit WhatsApp'));

console.log('\n--- Checking HTTP Server Response ---');
fetch('http://127.0.0.1:3000/')
  .then(res => res.text())
  .then(liveHtml => {
    console.log('Live server served Create account:', liveHtml.includes('Create account'));
    console.log('Live server served Aadhaar/Passport:', liveHtml.includes('Enter Name as per Aadhaar/Passport'));
    console.log('Live server served WhatsApp placeholder:', liveHtml.includes('Enter your phone number as WhatsApp'));
  })
  .catch(err => console.log('HTTP fetch error:', err.message));
