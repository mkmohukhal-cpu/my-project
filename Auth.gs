/**
 * =====================================================================
 * Auth.gs — المصدر الرسمي الوحيد للمصادقة والتوجيه (Routing) في النظام.
 * لا تكرر أي دالة من هنا في ملفات أخرى (Code.gs وغيره).
 * =====================================================================
 */

function createPasswordHash(password) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return rawHash.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function verifyPassword(password, hash) {
  return createPasswordHash(password) === hash;
}

/**
 * ينشئ حساب المدير الافتراضي مرة واحدة فقط، وفقط لو مفيش أي مستخدمين في النظام بالمرة.
 * بيانات المدير (البريد + كلمة المرور) لازم تتحط في Script Properties قبل أول تشغيل:
 * من Project Settings -> Script Properties أضف:
 *   DEFAULT_ADMIN_EMAIL    = admin@yourcompany.com
 *   DEFAULT_ADMIN_PASSWORD = كلمة مرور قوية من اختيارك
 */
function createDefaultAdmin() {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('ADMIN_BOOTSTRAP_DONE') === '1') return;

    const rows = Database.getAllRows(SHEET_USERS);
    if (rows.length > 0) {
      props.setProperty('ADMIN_BOOTSTRAP_DONE', '1');
      return;
    }

    const adminEmail = props.getProperty('DEFAULT_ADMIN_EMAIL');
    const adminPassword = props.getProperty('DEFAULT_ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      LoggerService.warn('لم يتم العثور على DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD في Script Properties. لن يتم إنشاء حساب مدير افتراضي حتى يتم ضبطهما.');
      return;
    }

    const adminUser = {
      userId: Helpers.generateId('USR'),
      employeeId: '',
      email: adminEmail.trim().toLowerCase(),
      passwordHash: createPasswordHash(adminPassword),
      role: ROLE_ADMIN,
      status: STATUS_ACTIVE,
      lastLogin: '',
      createdAt: new Date().toISOString()
    };
    Database.insertRow(SHEET_USERS, adminUser);
    props.setProperty('ADMIN_BOOTSTRAP_DONE', '1');
    LoggerService.info('تم إنشاء حساب المدير الافتراضي: ' + adminUser.email);
  } catch (err) {
    LoggerService.error('createDefaultAdmin error: ' + err.message);
  }
}

function loginUser(email, password) {
  try {
    createDefaultAdmin();
    if (!email || !password) {
      return Helpers.buildResponse(false, 'البريد الإلكتروني وكلمة المرور مطلوبان.');
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = Database.findRow(SHEET_USERS, 'email', cleanEmail);
    if (!user) {
      return Helpers.buildResponse(false, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }
    if (user.status === STATUS_DISABLED) {
      return Helpers.buildResponse(false, 'هذا الحساب معطل حالياً.');
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return Helpers.buildResponse(false, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }

    const sessionData = {
      userId: user.userId,
      employeeId: user.employeeId || '',
      name: user.email.split('@')[0],
      email: user.email,
      role: user.role,
      loginTime: new Date().toISOString()
    };

    const cache = CacheService.getUserCache();
    const token = Utilities.getUuid();
    cache.put(token, JSON.stringify(sessionData), 21600); // 6 ساعات
    PropertiesService.getUserProperties().setProperty('SESSION_TOKEN', token);

    Database.updateRow(SHEET_USERS, 'userId', user.userId, { lastLogin: new Date().toISOString() });
    LoggerService.info('تسجيل دخول ناجح: ' + user.email);

    return Helpers.buildResponse(true, 'تم تسجيل الدخول بنجاح', { email: user.email, role: user.role });
  } catch (err) {
    LoggerService.error('loginUser error: ' + err.message);
    return Helpers.buildResponse(false, 'حدث خطأ غير متوقع أثناء تسجيل الدخول: ' + err.message);
  }
}

function logoutUser() {
  try {
    const props = PropertiesService.getUserProperties();
    const token = props.getProperty('SESSION_TOKEN');
    if (token) {
      CacheService.getUserCache().remove(token);
      props.deleteProperty('SESSION_TOKEN');
    }
    return Helpers.buildResponse(true, 'تم تسجيل الخروج بنجاح.');
  } catch (err) {
    return Helpers.buildResponse(false, err.message);
  }
}

function getCurrentUser() {
  try {
    const props = PropertiesService.getUserProperties();
    const token = props.getProperty('SESSION_TOKEN');
    if (!token) return null;
    const cached = CacheService.getUserCache().get(token);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    return null;
  }
}

function isAuthenticated() {
  return getCurrentUser() !== null;
}

/**
 * نقطة الدخول الوحيدة للتطبيق. دايمًا بترجع Main.html (اللي بيقرر داخليًا
 * يعرض فورم الدخول أو الهيكل الكامل بالـ Sidebar حسب حالة الجلسة).
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const requestedPage = params.page || 'Dashboard';
    const employeeId = params.id || '';
    const authenticated = isAuthenticated();
    const currentUser = authenticated ? getCurrentUser() : null;

    const template = HtmlService.createTemplateFromFile('Main');
    template.isAuthenticated = authenticated;
    template.currentUser = currentUser;
    template.page = authenticated ? requestedPage : 'Login';
    template.employeeId = employeeId;

    return template.evaluate()
      .setTitle('نظام قاعدة بيانات الموظفين')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    return HtmlService.createHtmlOutput(
      '<div style="direction:ltr; padding:20px; font-family:sans-serif;"><h3>System Error</h3>' +
      '<p style="color:red;"><b>Message:</b> ' + error.message + '</p><pre>' + error.stack + '</pre></div>'
    );
  }
}

/**
 * include بسيط: يجيب محتوى ملف ثابت (بدون scriptlets ديناميكية).
 * يُستخدم للملفات اللي مالهاش داتا خاصة بيها (Footer, Scripts, Styles).
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    return '<!-- Error loading ' + filename + ': ' + error.message + ' -->';
  }
}

/**
 * include متقدم: بيعمل evaluate للملف كـ Template مستقل وبيمرر له بيانات
 * (زي currentUser أو employeeId) عشان يقدر يستخدم <?= ?> و <? ?> بداخله.
 * ده ضروري لأي partial فيه scriptlets (Sidebar, Header, Dashboard, Profile...).
 */
function includeWithData(filename, data) {
  try {
    const template = HtmlService.createTemplateFromFile(filename);
    if (data) {
      Object.keys(data).forEach(function(key) {
        template[key] = data[key];
      });
    }
    return template.evaluate().getContent();
  } catch (error) {
    return '<!-- Error loading ' + filename + ': ' + error.message + ' -->';
  }
}
