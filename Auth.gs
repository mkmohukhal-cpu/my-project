function createPasswordHash(password) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return rawHash.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function verifyPassword(password, hash) {
  return createPasswordHash(password) === hash;
}

function createDefaultAdmin() {
  try {
    const sheet = Database.getSheet('Users');
    const rows = Database.getAllRows('Users');
    
    const existingAdmin = rows.find(r => r.email === 'admin@company.com');
    if (!existingAdmin) {
      const adminUser = {
        userId: 'USR_ADMIN_01',
        employeeId: 'EMP_001',
        email: 'admin@company.com',
        passwordHash: createPasswordHash('Admin@123'),
        role: 'ADMIN',
        status: 'ACTIVE',
        lastLogin: '',
        createdAt: new Date().toISOString()
      };
      Database.insertRow('Users', adminUser);
    }
  } catch (err) {
    // تجاهل أو تسجيل الخطأ صامتاً
  }
}

function loginUser(email, password) {
  try {
    createDefaultAdmin();
    if (!email || !password) {
      return { success: false, message: 'البريد الإلكتروني وكلمة المرور مطلوبان.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = Database.findRow('Users', 'email', cleanEmail);
    if (!user) {
      return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
    }
    if (user.status === 'DISABLED') {
      return { success: false, message: 'هذا الحساب معطل حالياً.' };
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
    }

    const sessionData = {
      userId: user.userId,
      name: user.email.split('@')[0],
      email: user.email,
      role: user.role,
      loginTime: new Date().toISOString()
    };

    const cache = CacheService.getUserCache();
    const token = Utilities.getUuid();
    cache.put(token, JSON.stringify(sessionData), 21600);
    PropertiesService.getUserProperties().setProperty('SESSION_TOKEN', token);

    Database.updateRow('Users', 'userId', user.userId, { lastLogin: new Date().toISOString() });

    return { success: true, message: 'تم تسجيل الدخول بنجاح', data: { email: user.email, role: user.role } };
  } catch (err) {
    return { success: false, message: 'حدث خطأ غير متوقع أثناء تسجيل الدخول: ' + err.message };
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
    return { success: true, message: 'تم تسجيل الخروج بنجاح.' };
  } catch (err) {
    return { success: false, message: err.message };
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

// تعديل doGet لضمان إرجاع Main.html دائمًا (إلا لو لم يتم تسجيل الدخول)
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'main';
  const auth = isAuthenticated();
  
  if (!auth && page !== 'login') {
    return HtmlService.createTemplateFromFile('Login').evaluate()
      .setTitle('تسجيل الدخول')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  if (auth && page === 'login') {
    return buildMainTemplate('main');
  }
  
  return buildMainTemplate(page);
}

function buildMainTemplate(page) {
  const template = HtmlService.createTemplateFromFile('Main');
  template.page = page; // تمرير اسم الصفحة للـ Main.html
  return template.evaluate()
    .setTitle('نظام إدارة الموظفين')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}