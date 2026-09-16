const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxHkHC3bFpG0jvOhdQr3J6mUlvwxC_AV2aHgiYLoNJIm1bBprFFATh1SfBnvQkEkHZEPQ/exec';

const App = {
    // دالة توحيد أسماء الحقول بغض النظر عن لغة الأعمدة في قوقل شيت
    normalizeUser(user) {
        if (!user) return null;
        return {
            email: (user.email || user['البريد الإلكتروني'] || user['البريد'] || '').toString().trim().toLowerCase(),
            password: (user.password || user['كلمة المرور'] || user['رمز السر'] || '').toString().trim(),
            role: (user.role || user['الدور'] || user['الصلاحية'] || 'user').toString().trim(),
            name: (user.name || user['الاسم'] || '').toString().trim()
        };
    },

    // دالة قراءة البيانات المباشرة من قوقل شيت
    async readJson(key) {
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?key=${key}`);
            const data = await response.json();
            
            console.log(`البيانات المسترجعة من الشيت للمفتاح (${key}):`, data);

            if (Array.isArray(data)) {
                if (key === 'app_users') {
                    return data.map(this.normalizeUser).filter(u => u && u.email);
                }
                return data;
            }
            return [];
        } catch (error) {
            console.error(`خطأ أثناء الاتصال بقوقل شيت للمفتاح (${key}):`, error);
            return [];
        }
    },

    setCurrentUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    },

    getCurrentUser() {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }
};