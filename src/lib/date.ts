/** Analytics dates follow the PRD's Asia/Seoul calendar. */
export const toLocalDate=(date=new Date()):string=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
