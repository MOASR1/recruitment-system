(function () {
    // -----------------------------------------------------------------
    // 1. الإعدادات والبيانات الافتراضية
    // -----------------------------------------------------------------
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9JZ439WruguVlCVfHBggK1FIbLMkKyGQLKP8mn2hHAkzv2MtGWVh9PDuzFOBVeUF-pA/exec';

    const defaultUsers = [
        {
            id: 1,
            name: 'محمد راجحي',
            email: 'admin@domain.com',
            password: '123456',
            pass: '123456',
            title: 'مدير النظام',
            role: 'مدير النظام',
            dept: 'الموارد البشرية',
            perms: ['إنشاء طلب', 'إلغاء الطلب', 'عرض الطلبات', 'التعديل على الطلب', 'الموافقة على الطلب', 'اعتماد التوظيف', 'مدير النظام']
        },
        {
            id: 2,
            name: 'أحمد العتيبي',
            email: 'hr@domain.com',
            password: '123456',
            pass: '123456',
            title: 'مسؤول توظيف',
            role: 'مسؤول توظيف',
            dept: 'الموارد البشرية',
            perms: ['إنشاء طلب', 'عرض الطلبات', 'التعديل على الطلب']
        }
    ];

    const defaultDepartments = ['الموارد البشرية', 'الإدارة العليا', 'المالية', 'تقنية المعلومات'];

    // -----------------------------------------------------------------
    // 2. دوال التعامل مع البيانات (Google Sheets + LocalStorage الاحتياطي)
    // -----------------------------------------------------------------
    
    // قراءة البيانات من قوقل شيت
    async function readJson(key, fallback) {
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?key=${key}`);
            const data = await response.json();
            
            // إذا كانت البيانات مصفوفة وبها عناصر نرجعها مباشرة
            if (Array.isArray(data) && data.length > 0) {
                return key === 'app_users' ? data.map(normalizeUser) : data;
            }
            
            // إذا كانت الورقة فارغة في قوقل شيت، نرجع البيانات المحلية أو الافتراضية دون حفظ تلقائي
            const localValue = localStorage.getItem(key);
            return localValue ? JSON.parse(localValue) : fallback;
        } catch (error) {
            console.warn(`تعذر الاتصال بقوقل شيت للمفتاح (${key})، يتم استخدام LocalStorage:`, error);
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        }
    }

    // حفظ البيانات عند إجراء عمل فعلي من المستخدم فقط
    async function writeJson(key, value) {
        try {
            // حفظ نسخة محلية فوراً
            localStorage.setItem(key, JSON.stringify(value));

            // إرسال البيانات إلى قوقل شيت في الخلفية
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ key: key, data: value })
            });
            return true;
        } catch (error) {
            console.error(`خطأ أثناء حفظ البيانات في قوقل شيت للمفتاح (${key}):`, error);
            return false;
        }
    }

    // -----------------------------------------------------------------
    // 3. الدوال التنسيقية والصلاحيات
    // -----------------------------------------------------------------
    function normalizeUser(user) {
        if (!user || typeof user !== 'object') return null;
        return {
            ...user,
            password: user.password || user.pass || '',
            pass: user.pass || user.password || '',
            title: user.title || user.role || '',
            role: user.role || user.title || '',
            perms: Array.isArray(user.perms) ? user.perms : []
        };
    }

    // قراءة آمنة فقط دون استخدام writeJson لتجنب إنشاء أوراق عشوائية
    async function initAppData() {
        await readJson('app_users', defaultUsers);
        await readJson('app_departments', defaultDepartments);
        await readJson('app_requests', []);
    }

    function getCurrentUser() {
        const raw = localStorage.getItem('currentUser');
        if (!raw) return null;
        try {
            return normalizeUser(JSON.parse(raw));
        } catch (error) {
            localStorage.removeItem('currentUser');
            return null;
        }
    }

    function requireAuth() {
        const user = getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return null;
        }
        return user;
    }

    function isAdmin(user) {
        return Boolean(user && (
            user.role === 'مدير النظام' ||
            user.title === 'مدير النظام' ||
            (Array.isArray(user.perms) && user.perms.includes('مدير النظام'))
        ));
    }

    function applyAdminNavigation(user) {
        document.querySelectorAll('.admin-only').forEach(element => {
            element.classList.toggle('hidden', !isAdmin(user));
        });
    }

    function requireAdmin() {
        const user = requireAuth();
        if (!user) return null;
        if (!isAdmin(user)) {
            window.location.href = 'dashboard.html';
            return null;
        }
        return user;
    }

    function logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }

    // -----------------------------------------------------------------
    // 4. تصدير الكائن العام App
    // -----------------------------------------------------------------
    window.App = {
        defaultDepartments,
        defaultUsers,
        getCurrentUser,
        initAppData,
        applyAdminNavigation,
        isAdmin,
        logout,
        normalizeUser,
        readJson,
        writeJson,
        requireAuth,
        requireAdmin
    };
})();