// DOM Elements
const auth = {
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    passwordToggles: document.querySelectorAll('.password-toggle'),
    verificationModal: document.getElementById('verification-modal'),
    resendEmailBtn: document.getElementById('resend-email')
};

const AUTH_API_BASE_URL = window.API?.config?.BASE_URL || 'http://localhost:5000/api';

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initPasswordToggles();
    initLoginForm();
    initRegisterForm();
});

// Password Toggle
function initPasswordToggles() {
    auth.passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.closest('.input-with-icon').querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

// Login Form
function initLoginForm() {
    if (auth.loginForm) {
        auth.loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('remember-me').checked;
            
            // Simple validation
            if (!validateEmail(email)) {
                showNotification('Please enter a valid email address', 'error');
                return;
            }
            
            if (password.length < 6) {
                showNotification('Password must be at least 6 characters', 'error');
                return;
            }
            
            loginUser(email, password, rememberMe);
        });
    }
}

// Register Form
function initRegisterForm() {
    if (auth.registerForm) {
        // Password strength indicator
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('input', function() {
                updatePasswordStrength(this.value);
            });
        }
        
        // Form submission
        auth.registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const firstName = document.getElementById('first-name').value;
            const lastName = document.getElementById('last-name').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const terms = document.getElementById('terms').checked;
            
            // Validation
            if (!firstName.trim()) {
                showNotification('Please enter your first name', 'error');
                return;
            }
            
            if (!lastName.trim()) {
                showNotification('Please enter your last name', 'error');
                return;
            }
            
            if (!validateEmail(email)) {
                showNotification('Please enter a valid email address', 'error');
                return;
            }
            
            if (!validatePhone(phone)) {
                showNotification('Please enter a valid phone number', 'error');
                return;
            }
            
            if (password.length < 8) {
                showNotification('Password must be at least 8 characters', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showNotification('Passwords do not match', 'error');
                return;
            }
            
            if (!terms) {
                showNotification('Please agree to the terms and conditions', 'error');
                return;
            }
            
            registerUser(firstName, lastName, email, phone, password);
        });
    }
    
    // Resend email
    if (auth.resendEmailBtn) {
        auth.resendEmailBtn.addEventListener('click', function() {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            
            setTimeout(() => {
                this.disabled = false;
                this.innerHTML = '<i class="fas fa-redo"></i> Resend Email';
                showNotification('Verification email sent!', 'success');
            }, 1500);
        });
    }
}

async function loginUser(email, password, rememberMe) {
    // Show loading state
    const submitBtn = auth.loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
    
    try {
        const response = await fetch(`${AUTH_API_BASE_URL}/auth/login/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Invalid email or password');
        }

        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('user', JSON.stringify({
            id: data.user.id,
            firstName: data.user.first_name,
            lastName: data.user.last_name,
            email: data.user.email,
            phone: data.user.phone,
            role: data.user.role,
            restaurant_id: data.user.restaurant_id || null,
            status: data.user.status
        }));

        if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
        }

        showNotification('Login successful!', 'success');

        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');

        setTimeout(() => {
            if (redirect) {
                window.location.href = `${redirect}.html`;
            } else {
                window.location.href = 'index.html';
            }
        }, 1000);
    } catch (error) {
        showNotification(error.message || 'Login failed', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function registerUser(firstName, lastName, email, phone, password) {
    // Show loading state
    const submitBtn = auth.registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    
    try {
        const response = await fetch(`${AUTH_API_BASE_URL}/auth/register/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
                password,
                password2: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const firstError = Object.values(data)[0];
            const message = Array.isArray(firstError) ? firstError[0] : firstError || 'Registration failed';
            throw new Error(message);
        }

        // Store tokens and user — same pattern as loginUser().
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        localStorage.setItem('userLoggedIn', 'true');
        localStorage.setItem('user', JSON.stringify({
            id: data.user.id,
            firstName: data.user.first_name,
            lastName: data.user.last_name,
            email: data.user.email,
            phone: data.user.phone,
            role: data.user.role,
            restaurant_id: data.user.restaurant_id || null,
            status: data.user.status
        }));

        showNotification(data.message || 'Account created successfully!', 'success');

        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1000);
    } catch (error) {
        showNotification(error.message || 'Registration failed', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Validate Email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate Phone
function validatePhone(phone) {
    const re = /^[\+]?[1-9][\d]{0,15}$/;
    return re.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Update Password Strength
function updatePasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    let strength = 0;
    let text = 'Very Weak';
    let color = '#d63031'; // Red
    
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    switch (strength) {
        case 1:
            text = 'Weak';
            color = '#e17055';
            break;
        case 2:
            text = 'Fair';
            color = '#fdcb6e';
            break;
        case 3:
            text = 'Good';
            color = '#00cec9';
            break;
        case 4:
            text = 'Strong';
            color = '#00b894';
            break;
    }
    
    strengthBar.style.width = `${strength * 25}%`;
    strengthBar.style.backgroundColor = color;
    strengthText.textContent = text;
    strengthText.style.color = color;
}

// Show Notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;

    // Add to body
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 10);

    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });

    // Auto remove
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Get Notification Icon
function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Close Verification Modal
if (auth.verificationModal) {
    const closeBtn = auth.verificationModal.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            auth.verificationModal.classList.remove('show');
        });
    }
    
    auth.verificationModal.addEventListener('click', (e) => {
        if (e.target === auth.verificationModal) {
            auth.verificationModal.classList.remove('show');
        }
    });
}




