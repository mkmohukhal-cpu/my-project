/**
 * Backend notification infrastructure handlers.
 */
const NotificationService = {
  triggerAlert: function(title, message) {
    LoggerService.info('Notification: ' + title + ' - ' + message);
    return true;
  }
};

/**
 * يجيب كل الإشعارات الخاصة بالمستندات المنتهية أو التي توشك على الانتهاء.
 * الدالة الرسمية الوحيدة بهذا الاسم في المشروع — لا تُكرر في Code.gs.
 */
function getSystemNotifications() {
  try {
    const documents = Database.getAllRows(SHEET_DOCUMENTS);
    const notifications = [];

    documents.forEach(doc => {
      const status = calculateExpiryStatus(doc.expiryDate);
      if (status === 'Expired' || status === 'Expiring Soon') {
        notifications.push({
          employeeId: doc.employeeId,
          type: 'مستند: ' + doc.documentType,
          expiryDate: doc.expiryDate,
          status: status,
          fileName: doc.documentName || '-'
        });
      }
    });

    return Helpers.buildResponse(true, 'Notifications retrieved', notifications);
  } catch (error) {
    LoggerService.error('getSystemNotifications error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}

/**
 * يبعت تقرير يومي بالبريد الإلكتروني للمستندات والعقود المنتهية أو الموشكة على الانتهاء.
 * لتفعيلها تلقائيًا: أضف Trigger زمني (Time-driven) على هذه الدالة من محرر Apps Script.
 */
function sendDailyExpiryAlerts() {
  try {
    const response = getSystemNotifications();
    const notifications = response.success ? response.data : [];
    if (!notifications || notifications.length === 0) return;

    const adminEmail = PropertiesService.getScriptProperties().getProperty('DEFAULT_ADMIN_EMAIL')
      || Session.getActiveUser().getEmail();
    if (!adminEmail) return;

    let htmlBody = '<h3>تقرير تنبيهات انتهاء الصلاحية اليومي</h3>';
    htmlBody += '<p>المستندات والعقود التالية تتطلب تدخلاً فورياً:</p>';
    htmlBody += '<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
    htmlBody += '<tr style="background-color: #f2f2f2;"><th>رقم الموظف</th><th>نوع البند</th><th>تاريخ الانتهاء</th><th>الحالة</th><th>اسم الملف</th></tr>';

    notifications.forEach(n => {
      const statusColor = n.status === 'Expired' ? 'red' : 'orange';
      htmlBody += '<tr>'
        + '<td>' + n.employeeId + '</td>'
        + '<td>' + n.type + '</td>'
        + '<td>' + (n.expiryDate || '-') + '</td>'
        + '<td style="color: ' + statusColor + '; font-weight: bold;">' + (n.status === 'Expired' ? 'منتهي' : 'قارب على الانتهاء') + '</td>'
        + '<td>' + n.fileName + '</td>'
        + '</tr>';
    });
    htmlBody += '</table>';

    GmailApp.sendEmail(adminEmail, 'تنبيه هام: مستندات وعقود موظفين بحاجة للمراجعة', '', { htmlBody: htmlBody });
    LoggerService.info('Daily expiry alert email sent to ' + adminEmail);
  } catch (error) {
    LoggerService.error('sendDailyExpiryAlerts error: ' + error.message);
  }
}
