document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('userLoggedIn') !== 'true') {
        window.location.href = 'login.html?redirect=settings';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const avatar = document.getElementById('settings-avatar');
    const form = document.getElementById('settings-form');
    const firstNameInput = document.getElementById('settings-first-name');
    const lastNameInput = document.getElementById('settings-last-name');
    const emailInput = document.getElementById('settings-email');
    const phoneInput = document.getElementById('settings-phone');

    function updateAvatar() {
        const initials = `${firstNameInput.value?.[0] || ''}${lastNameInput.value?.[0] || ''}`.trim() || 'U';
        avatar.textContent = initials.toUpperCase();
    }

    firstNameInput.value = user.firstName || '';
    lastNameInput.value = user.lastName || '';
    emailInput.value = user.email || '';
    phoneInput.value = user.phone || '';
    updateAvatar();

    firstNameInput.addEventListener('input', updateAvatar);
    lastNameInput.addEventListener('input', updateAvatar);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const payload = {
                first_name: firstNameInput.value.trim(),
                last_name: lastNameInput.value.trim(),
                phone: phoneInput.value.trim()
            };

            const profile = await API.service.updateProfile(payload);
            localStorage.setItem('user', JSON.stringify({
                ...user,
                firstName: profile.first_name,
                lastName: profile.last_name,
                email: profile.email,
                phone: profile.phone,
                role: profile.role || user.role,
                status: profile.status || user.status
            }));
            showNotification('Profile updated successfully.', 'success');
            checkLoginStatus();
            updateAvatar();
        } catch (error) {
            showNotification(error.message || 'Unable to update profile.', 'error');
        }
    });
});
