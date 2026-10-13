// Paste into a standalone Google Apps Script project. Do not put credentials here.
// Fixed recipient + fixed event text: this is not a general-purpose email relay.
const RECIPIENT = 'sakthiharish01@gmail.com';
const LABELS = {
  security_passed: 'A visitor passed the questions',
  photos_viewed: 'Photos were visible on screen',
  letter_viewed: 'The letter heading was visible on screen',
  answer_yes: 'A visitor clicked Yes',
  answer_need_time: 'A visitor clicked Need time'
};
function setup() {
  MailApp.sendEmail(RECIPIENT, 'Website activity: setup test',
    'Email alerts are authorized. Deploy this script as a web app to connect the website.');
}
function doPost(e) {
  const reply = message => ContentService.createTextOutput(message);
  let data;
  try {
    const body = e.postData.contents;
    if (body.length > 512) return reply('Rejected');
    data = JSON.parse(body);
  } catch (_) { return reply('Rejected'); }
  if (!data || data.consent !== true ||
      !Object.prototype.hasOwnProperty.call(LABELS, data.event) ||
      typeof data.visit !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(data.visit)) return reply('Rejected');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return reply('Busy');
  try {
    const props = PropertiesService.getScriptProperties();
    const day = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
    if (props.getProperty('day') !== day) {
      // Dedicated project only: these properties belong entirely to activity alerts.
      props.deleteAllProperties();
      props.setProperties({day, count: '0'});
    }
    const key = data.visit + ':' + data.event;
    if (props.getProperty(key)) return reply('Duplicate');
    const count = Number(props.getProperty('count') || 0);
    // Public browser endpoints can be spoofed; cap the possible email volume.
    if (count >= 40 || MailApp.getRemainingDailyQuota() < 1) return reply('Daily limit');
    const when = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, HH:mm:ss');
    MailApp.sendEmail({
      to: RECIPIENT,
      subject: 'Website activity: ' + LABELS[data.event],
      body: LABELS[data.event] + '\n\nReceived: ' + when + ' IST' +
        '\nVisit reference: ' + data.visit +
        '\n\nThis is a browser-reported event, not proof of identity or reading. ' +
        'No birthdays, movie answers, photos, or letter content are included.',
      name: 'Our Memories'
    });
    props.setProperty(key, '1');
    props.setProperty('count', String(count + 1));
    return reply('Accepted');
  } finally { lock.releaseLock(); }
}
