// "Today" as the person using the app sees it (their local date, YYYY-MM-DD).
// The server never decides what "today" is -- timezones would get it wrong for
// an evening session in, say, Singapore.
export const todayKey = () => new Date().toLocaleDateString("en-CA");
