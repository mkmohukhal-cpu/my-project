/**
 * Backend notification infrastructure handlers.
 */
const NotificationService = {
  triggerAlert: function(title, message) {
    LoggerService.info('Notification: ' + title + ' - ' + message);
    return true;
  }
};// دالة لجلب الإشعارات الخاصة بالعقود والمستندات المنتهية والتي توشك على الانتهاء
function getSystemNotifications() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let notifications = [];
  
  // فحص المستندات
  const docSheet = ss.getSheetByName("Documents");
  if (docSheet) {
    const data = docSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const status = calculateExpiryStatus(data[i][4]);
      if (status === 'Expired' || status === 'Expiring Soon') {
        notifications.push({
          employeeId: data[i][1],
          type: 'مستند: ' + data[i][2],
          expiryDate: data[i][4],
          status: status,
          fileName: data[i][7] || '-'
        });
      }
    }
  }
  
  return notifications;
}
// دالة إرسال التنبيهات بالبريد الإلكتروني للمسؤولين عن العقود والمستندات المنتهية
function sendDailyExpiryAlerts() {
  const notifications = getSystemNotifications();
  if (!notifications || notifications.length === 0) return;
  
  // حط هنا إيميل المسؤول أو إيميلك اللي هيوصل عليه التقرير
  const adminEmail = Session.getActiveUser().getEmail() || "admin@yourdomain.com"; 
  
  let htmlBody = `<h3>تقرير تنبيهات انتهاء الصلاحية اليومي</h3>`;
  htmlBody += `<p>المستندات والعقود التالية تتطلب تدخلاً فورياً:</p>`;
  htmlBody += `<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">`;
  htmlBody += `<tr style="background-color: #f2f2f2;"><th>رقم الموظف</th><th>نوع البند</th><th>تاريخ الانتهاء</th><th>الحالة</th><th>اسم الملف</th></tr>`;
  
  notifications.forEach(n => {
    const statusColor = n.status === 'Expired' ? 'red' : 'orange';
    htmlBody += `<tr>
      <td>${n.employeeId}</td>
      <td>${n.type}</td>
      <td>${n.expiryDate || '-'}</td>
      <td style="color: ${statusColor}; font-weight: bold;">${n.status === 'Expired' ? 'منتهي' : 'قارب على الانتهاء'}</td>
      <td>${n.fileName}</td>
    </tr>`;
  });
  
  htmlBody += `</table>`;
  
  GmailApp.sendEmail(adminEmail, "تنبيه هام: مستندات وعقود موظفين بحاجة للمراجعة", "", {
    htmlBody: htmlBody
  });
}