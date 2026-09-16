/**
 * ====================================================================
 * نظام الاعتمادات وإدارة التوظيف والموافقات - المحرك الرئيسي (App)
 * الربط المباشر مع Google Sheets بجميع المفاتيح والتعديلات الحديثة
 * ====================================================================
 */

(function () {
    'use strict';

    // -----------------------------------------------------------------
    // 1. رابط خادم Google Apps Script والبيانات الافتراضية
    // -----------------------------------------------------------------
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxHkHC3bFpG0jvOhdQr3J6mUlvwxC_AV2aHgiYLoNJIm1bBprFFATh1SfBnvQkEkHZEPQ/exec';

    // البيانات الافتراضية للحساب المرجعي
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
            perms: [
                'إنشاء طلب',
                'إلغاء الطلب',
                'عرض الطلبات',
                'التعديل على الطلب',
                'الموافقة على الطلب',
                'اعتماد التوظيف',
                'إدارة المستخدمين',
                'إدارة الأقسام',
                'سلسلة الاعتمادات',
                'سجلات الأمان',
                'مدير النظام'
            ]
        }
    ];

    const defaultDepartments = [
        { id: 1, name: 'الموارد البشرية', code: 'HR', manager: 'محمد راجحي' },
        { id: 2, name: 'الإدارة العليا', code: 'EXEC', manager: 'الرئيس التنفيذي' },
        { id: 3, name: 'المالية', code: 'FIN', manager: 'مدير المالية' },
        { id: 4, name: 'تقنية المعلومات', code: 'IT', manager: 'مدير التقنية' },
        { id: 5, name: 'العمليات والتشغيل', code: 'OPS', manager: 'مدير العمليات' }
    ];

    const defaultApprovals = [
        { step: 1, title: 'موافقة مدير القسم', role: 'مدير القسم', required: true },
        { step: 2, title: 'اعتماد الموارد البشرية', role: 'مدير الموارد البشرية', required: true },
        { step: 3, title: 'التدقيق المالي', role: 'المدير المالي', required: true },
        { step: 4, title: 'الاعتماد النهائي', role: 'الرئيس التنفيذي', required: true }
    ];

    // -----------------------------------------------------------------
    // 2. دوال توحيد صيغ البيانات (Data Normalizers)
    // -----------------------------------------------------------------
    
    // توحيد بيانات المستخدم لدعم الأعمدة بالعربية والإنجليزية
    function normalizeUser(user) {
        if (!user || typeof user !== 'object') return null;
        
        const rawPerms = user.perms || user['الصلاحيات'] || user['الصلاحية'] || [];
        let parsedPerms = [];
        if (Array.isArray(rawPerms)) {
            parsedPerms = rawPerms;
        } else if (typeof rawPerms === 'string') {
            try {
                parsedPerms = JSON.parse(rawPerms);
            } catch (e) {
                parsedPerms = rawPerms.split(',').map(p => p.trim()).filter(Boolean);
            }
        }

        return {
            id: user.id || user['المعرف'] || Date.now(),
            name: (user.name || user['الاسم'] || '').toString().trim(),
            email: (user.email || user['البريد الإلكتروني'] || user['البريد'] || '').toString().trim().toLowerCase(),
            password: (user.password || user.pass || user['كلمة المرور'] || user['رمز السر'] || '').toString().trim(),
            pass: (user.password || user.pass || user['كلمة المرور'] || user['رمز السر'] || '').toString().trim(),
            title: (user.title || user.role || user['المسمى الوظيفي'] || user['الدور'] || '').toString().trim(),
            role: (user.role || user.title || user['الدور'] || user['الصلاحية'] || '').toString().trim(),
            dept: (user.dept || user['القسم'] || user['الإدارة'] || '').toString().trim(),
            perms: parsedPerms
        };
    }

    // توحيد بيانات طلب التوظيف
    function normalizeRequest(req) {
        if (!req || typeof req !== 'object') return null;

        let history = [];
        if (Array.isArray(req.history)) history = req.history;
        else if (typeof req.history === 'string' && req.history.trim()) {
            try { history = JSON.parse(req.history); } catch (e) { history = []; }
        }

        return {
            id: req.id || req['رقم الطلب'] || `REQ-${Date.now()}`,
            title: req.title || req['عنوان الوظيفة'] || req['المسمى الوظيفي'] || '',
            dept: req.dept || req['القسم'] || req['الإدارة'] || '',
            count: Number(req.count || req['عدد الوظائف'] || 1),
            type: req.type || req['نوع التوظيف'] || 'دوام كامل',
            priority: req.priority || req['الأولوية'] || 'عادي',
            status: req.status || req['حالة الطلب'] || 'قيد الانتظار',
            currentStep: Number(req.currentStep || req['المرحلة الحالية'] || 1),
            createdBy: req.createdBy || req['صاحب الطلب'] || '',
            createdAt: req.createdAt || req['تاريخ الإنشاء'] || new Date().toISOString().split('T')[0],
            reason: req.reason || req['مبررات التوظيف'] || '',
            requirements: req.requirements || req['المتطلبات الوظيفية'] || '',
            history: history
        };
    }

    // توحيد بيانات الأقسام
    function normalizeDepartment(dept) {
        if (!dept || typeof dept !== 'object') return null;
        return {
            id: dept.id || dept['المعرف'] || Date.now(),
            name: (dept.name || dept['اسم القسم'] || dept['القسم'] || '').toString().trim(),
            code: (dept.code || dept['رمز القسم'] || '').toString().trim(),
            manager: (dept.manager || dept['مدير القسم'] || '').toString().trim()
        };
    }

    // توحيد سجلات الأمان والعمليات
    function normalizeLog(log) {
        if (!log || typeof log !== 'object') return null;
        return {
            id: log.id || Date.now(),
            timestamp: log.timestamp || log['التاريخ والوقت'] || new Date().toLocaleString('ar-SA'),
            user: log.user || log['المستخدم'] || 'النظام',
            action: log.action || log['الإجراء'] || '',
            details: log.details || log['التفاصيل'] || ''
        };
    }

    // -----------------------------------------------------------------
    // 3. دوال التواصل مع خادم Google Sheets (Read / Write API)
    // -----------------------------------------------------------------

    /**
     * جلب البيانات المباشرة من قوقل شيت بناءً على المفتاح
     */
    async function readJson(key, fallback = []) {
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?key=${key}`);
            const data = await response.json();

            console.log(`[Google Sheets] قراءة البيانات للمفتاح (${key}):`, data);

            if (Array.isArray(data) && data.length > 0) {
                const validItems = data.filter(item => item && typeof item === 'object' && Object.keys(item).length > 0);
                
                if (validItems.length > 0) {
                    let normalizedData = validItems;
                    if (key === 'app_users') normalizedData = validItems.map(normalizeUser).filter(Boolean);
                    if (key === 'app_requests') normalizedData = validItems.map(normalizeRequest).filter(Boolean);
                    if (key === 'app_departments') normalizedData = validItems.map(normalizeDepartment).filter(Boolean);
                    if (key === 'app_logs') normalizedData = validItems.map(normalizeLog).filter(Boolean);

                    // التحديث الفوري للذاكرة المحلية لضمان التزامن
                    localStorage.setItem(key, JSON.stringify(normalizedData));
                    return normalizedData;
                }
            }

            // الاحتياطي من الذاكرة المحلية عند استرجاع جدول فارغ من قوقل
            const localValue = localStorage.getItem(key);
            return localValue ? JSON.parse(localValue) : fallback;

        } catch (error) {
            console.warn(`[Google Sheets] تعذر القراءة للمفتاح (${key})، استخدام الذاكرة المحلية:`, error);
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        }
    }

    /**
     * حفظ وحفظ البيانات في قوقل شيت عبر POST
     */
    async function writeJson(key, value) {
        try {
            // 1. حفظ نسخة في الذاكرة المحلية أولاً لاستجابة الشاشة المباشرة
            localStorage.setItem(key, JSON.stringify(value));

            // 2. التحديث في خادم قوقل شيت
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ key: key, data: value })
            });

            console.log(`[Google Sheets] تم إرسال عملية الحفظ بنجاح للمفتاح (${key})`);
            return true;

        } catch (error) {
            console.error(`[Google Sheets] خطأ أثناء الحفظ في قوقل شيت للمفتاح (${key}):`, error);
            return false;
        }
    }

    /**
     * إضافة حدث جديد إلى سجلات الأمان
     */
    async function appendLog(action, details) {
        const user = getCurrentUser();
        const logs = await readJson('app_logs', []);
        const newLog = {
            id: Date.now(),
            timestamp: new Date().toLocaleString('ar-SA'),
            user: user ? `${user.name} (${user.email})` : 'زائر / غير مسجل',
            action: action,
            details: details
        };
        logs.unshift(newLog); // إضافة الحدث في البداية
        await writeJson('app_logs', logs.slice(0, 100)); // الاحتفاظ بأحدث 100 حدث
    }

    // -----------------------------------------------------------------
    // 4. إدارة الجلسة والتحقق الصارم من الصلاحيات
    // -----------------------------------------------------------------

    function setCurrentUser(user) {
        const normalized = normalizeUser(user);
        localStorage.setItem('currentUser', JSON.stringify(normalized));
        appendLog('تسجيل دخول', 'تم تسجيل الدخول بنجاح إلى النظام');
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
        if (!user) return false;
        return Boolean(
            user.role === 'مدير النظام' ||
            user.title === 'مدير النظام' ||
            (Array.isArray(user.perms) && user.perms.includes('مدير النظام'))
        );
    }

    function hasPermission(user, permissionName) {
        if (!user) return false;
        if (isAdmin(user)) return true;
        return Array.isArray(user.perms) && user.perms.includes(permissionName);
    }

    function applyAdminNavigation(user) {
        const currentUser = user || getCurrentUser();
        if (!currentUser) return;

        // إخفاء العناوين التي تتطلب صلاحيات أدمن فقط
        document.querySelectorAll('.admin-only').forEach(element => {
            element.classList.toggle('hidden', !isAdmin(currentUser));
        });

        // إخفاء أو إظهار العناصر بحسب الصلاحية المحددة في العنصر
        document.querySelectorAll('[data-perm]').forEach(element => {
            const requiredPerm = element.getAttribute('data-perm');
            element.classList.toggle('hidden', !hasPermission(currentUser, requiredPerm));
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
        appendLog('تسجيل خروج', 'تم خروج المستخدم من النظام');
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }

    // -----------------------------------------------------------------
    // 5. دوال مساعدة سهلة الاستخدام للصفحات (Helper Methods)
    // -----------------------------------------------------------------

    async function getUsers() { return await readJson('app_users', defaultUsers); }
    async function saveUsers(users) { return await writeJson('app_users', users); }

    async function getRequests() { return await readJson('app_requests', []); }
    async function saveRequests(requests) { return await writeJson('app_requests', requests); }

    async function getDepartments() { return await readJson('app_departments', defaultDepartments); }
    async function saveDepartments(depts) { return await writeJson('app_departments', depts); }

    async function getApprovals() { return await readJson('app_approvals', defaultApprovals); }
    async function saveApprovals(approvals) { return await writeJson('app_approvals', approvals); }

    async function getLogs() { return await readJson('app_logs', []); }

    async function initAppData() {
        await getUsers();
        await getDepartments();
        await getApprovals();
        await getRequests();
    }

    // -----------------------------------------------------------------
    // 6. تصدير الكائن العام App
    // -----------------------------------------------------------------
    window.App = {
        GOOGLE_SCRIPT_URL,
        defaultDepartments,
        defaultUsers,
        defaultApprovals,
        
        // إدارة الحساب والجلسة
        getCurrentUser,
        setCurrentUser,
        requireAuth,
        requireAdmin,
        isAdmin,
        hasPermission,
        applyAdminNavigation,
        logout,

        // معالجات البيانات والقراءة والحفظ
        normalizeUser,
        normalizeRequest,
        normalizeDepartment,
        normalizeLog,
        readJson,
        writeJson,
        appendLog,

        // اختصارات الجلب والحفظ للملفات
        getUsers,
        saveUsers,
        getRequests,
        saveRequests,
        getDepartments,
        saveDepartments,
        getApprovals,
        saveApprovals,
        getLogs,
        initAppData
    };

})();