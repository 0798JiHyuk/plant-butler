import { useState, type ReactNode } from 'react';
import { copy } from '@/core/copy';
import { todayKey } from '@/core/clock';
import { events } from '@/core/events';
import { limitReached } from '@/core/rules';
import { store } from '@/core/store';
import { activeMissionSession, bookmarkSuggestion, categories, chooseMissionStage, closeMissionSession, createMissionProgress,
  customEligibility, missionById, missionCandidates, missionEligibility, missionProgress, missions, resumeMissionBookmark,
  restMissions, recommendedMission, reduceMission, saveCustomMission, saveMissionBookmark, saveMyDay, setMissionCategory, setMissionFact, startDayMission, startMission } from '@/core/missions';
import type { CategoryId, CustomMission, DayMission, Mission, MissionBookmark, MissionProgress, MissionVariant } from '@/core/missionTypes';
import type { ReflectChip } from '@/core/types';
import { closeModal, openModal } from '@/ui/modal';
import { IconBtn } from '@/ui/icons';
import { useAppState } from '@/ui/useAppState';
import { showToast } from '@/ui/toast';
import { PanelHead } from './PanelHead';

type Screen = 'category' | 'context' | 'academic' | 'work' | 'menu' | 'card' | 'stage' | 'conditions' | 'alternatives' | 'catalog' | 'execution'
  | 'options' | 'editor' | 'editorMore' | 'customList' | 'day' | 'dayOptions' | 'dayPick' | 'after' | 'bookmark' | 'resume';
type Draft = Omit<CustomMission, 'id' | 'categoryId'>;
const emptyDraft = (): Draft => ({ name: '', basic: '', small: '', trigger: '', criterion: '' });
const text = copy.missions;
function Button({ children, onClick, disabled = false, primary = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`} disabled={disabled} onClick={onClick}>{children}</button>;
}

function MissionPanel({ after = false }: { after?: boolean; details?: boolean }) {
  const state = useAppState(); const p = missionProgress(state); const category = p.selectedCategory;
  const initial = recommendedMission(p);
  const [screen, setScreen] = useState<Screen>(() => after ? 'after' : p.execution ? 'execution' : activeMissionSession(state)?.reportedActions.length ? 'after' : !category ? 'category' : p.myDays[category]?.length ? 'day' : !p.selectedIntent ? 'context' : initial ? initial.stage > p.stages[category] ? 'stage' : 'card' : 'menu');
  const [selectedId, setSelectedId] = useState<string | undefined>(initial?.id);
  const [history, setHistory] = useState<{ screen: Screen; selectedId?: string; page: number }[]>([]);
  const [allScenes, setAllScenes] = useState(false);
  const [dayEditing, setDayEditing] = useState(false);
  const [page, setPage] = useState(0);
  const [catalogTarget, setCatalogTarget] = useState<'card' | 'editor'>('card');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editId, setEditId] = useState<string>();
  const [parentId, setParentId] = useState<string>();
  const [parentVariant, setParentVariant] = useState<MissionVariant>('basic');
  const [editorVariant, setEditorVariant] = useState<MissionVariant>('basic');
  const [dayPickIndex, setDayPickIndex] = useState<number | null>(null);
  const [entries, setEntries] = useState<DayMission[]>(() => category && p.myDays[category]?.length ? structuredClone(p.myDays[category]!) : [0, 1].map((_, i) => ({ id: crypto.randomUUID(), customId: category ? p.custom.filter(c => c.categoryId === category)[i]?.id ?? '' : '', cue: text.cues[i] })));
  const [daySelected, setDaySelected] = useState(() => Math.max(0, category ? (p.myDays[category] ?? []).findIndex(e => e.id === p.selectedDayEntry?.[category]) : 0));
  const [dayVariant, setDayVariant] = useState<MissionVariant>('basic');
  const [restCue, setRestCue] = useState(category ? p.restCues?.[category] ?? '' : '');
  const [bookmark, setBookmark] = useState<MissionBookmark | null>(null);
  const [chips, setChips] = useState<ReflectChip[]>(() => {
    const active = activeMissionSession(state); const report = active?.reportedActions[active.reportedActions.length - 1];
    return state.logs.find(l => l.id === report?.logId)?.chips ?? [];
  });
  const [error, setError] = useState('');
  const session = activeMissionSession(state);
  const last = session?.reportedActions[session.reportedActions.length - 1];
  const m = missionById(selectedId);
  const edit = (fn: (progress: MissionProgress) => void) => store.update(s => { s.missions ??= createMissionProgress(); fn(s.missions); });
  const go = (next: Screen) => { setError(''); setPage(0); if (next !== screen) setHistory(old => [...old, { screen, selectedId, page }]); setScreen(next); };
  const back = () => { const previous = history[history.length - 1]; if (!previous) return; setError(''); setPage(previous.page); setSelectedId(previous.selectedId); setHistory(old => old.slice(0, -1)); setScreen(previous.screen); };
  const selectCategory = (id: CategoryId) => {
    store.update(s => setMissionCategory(s, id)); setParentId(undefined);
    setEntries(p.myDays[id]?.length ? structuredClone(p.myDays[id]!) : [0, 1].map((_, i) => ({ id: crypto.randomUUID(), customId: p.custom.filter(c => c.categoryId === id)[i]?.id ?? '', cue: text.cues[i] })));
    setDaySelected(Math.max(0, (p.myDays[id] ?? []).findIndex(e => e.id === p.selectedDayEntry?.[id]))); setRestCue(p.restCues?.[id] ?? ''); setAllScenes(false); go('context');
  };
  const openCard = (mission: Mission) => {
    setSelectedId(mission.id);
    if (category && !mission.intentIds.includes('all') && !mission.intentIds.includes(p.selectedIntent ?? '')) edit(x => { x.selectedIntent = mission.intentIds[0]; });
    go(mission.stage > p.stages[mission.categoryId] ? 'stage' : 'card');
  };
  const chooseIntent = (intent: string) => { edit(x => { x.selectedIntent = intent; }); if (category === 'academic') go('academic'); else { const next = recommendedMission({ ...p, selectedIntent: intent }); if (next) openCard(next); else go('menu'); } };
  const suggested = () => recommendedMission(p);
  const rest = () => { store.update(s => restMissions(s, todayKey())); closeModal(); };
  const startVariant = (variant: MissionVariant) => {
    if (!m) return;
    if (m.mode !== 'activity' || m.eligibility.inheritCustomActionRequirements) {
      setParentId(m.id); setParentVariant(variant); setEditorVariant(variant);
      if (m.mode === 'create_and_execute' || m.mode === 'activity') { setDraft(emptyDraft()); setEditId(undefined); go('editor'); }
      else {
        const existing = category ? p.myDays[category] : undefined;
        setEntries(existing?.length ? structuredClone(existing) : Array.from({ length: variant === 'small' ? 1 : 2 }, (_, i) => ({ id: crypto.randomUUID(), customId: p.custom.filter(c => c.categoryId === category)[i]?.id ?? '', cue: text.cues[i] })));
        setDaySelected(Math.max(0, (existing ?? []).findIndex(e => e.id === p.selectedDayEntry?.[category!]))); go('day');
      }
      return;
    }
    let ok = false; store.update(s => { ok = startMission(s, todayKey(), m.id, variant, true); });
    if (ok) closeModal(); else setError(text.noMatch);
  };
  const create = () => { setParentId(undefined); setDayPickIndex(null); setEditId(undefined); setDraft(emptyDraft()); go('editor'); };
  const openDay = () => {
    setParentId(undefined);
    if (category) setEntries(p.myDays[category]?.length ? structuredClone(p.myDays[category]!) : [0, 1].map((_, i) => ({ id: crypto.randomUUID(), customId: p.custom.filter(c => c.categoryId === category)[i]?.id ?? '', cue: text.cues[i] })));
    setDaySelected(Math.max(0, category ? (p.myDays[category] ?? []).findIndex(e => e.id === p.selectedDayEntry?.[category]) : 0)); go('day');
  };
  const copyCard = (mission: Mission) => { setEditId(undefined); setDraft({ name: mission.name, basic: mission.basic, small: mission.small, trigger: '', criterion: mission.basic, sourceMissionId: mission.id }); go('editor'); };
  const openCatalog = (target: 'card' | 'editor') => { setCatalogTarget(target); go('catalog'); };
  const saveDraft = (execute: boolean) => {
    if (!category) { go('category'); return; }
    let id: string | null = null;
    store.update(s => { id = saveCustomMission(s, { ...draft, categoryId: category, criterion: draft.criterion.trim() || draft.basic }, editId); });
    if (!id) { setError(text.invalid); return; }
    setEditId(id);
    if (dayPickIndex !== null) {
      setEntries(old => old.map((e, i) => i === dayPickIndex ? { ...e, customId: id! } : e)); setDayPickIndex(null); go('day'); return;
    }
    if (execute) {
      let ok = false; store.update(s => { ok = startMission(s, todayKey(), parentId ?? draft.sourceMissionId ?? '', editorVariant, true, id!, parentId); });
      if (ok) closeModal(); else setError(text.noMatch);
    } else { showToast([text.saved]); go('customList'); }
  };
  const saveDay = (execute: boolean) => {
    if (!category) return;
    let saved = false;
    store.update(s => { saved = saveMyDay(s, category, entries); if (saved) { s.missions!.restCues ??= {}; s.missions!.restCues[category] = restCue; s.missions!.selectedDayEntry![category] = entries[daySelected]?.id ?? entries[0].id; } });
    if (!saved) { setError(text.dayInvalid); return; }
    if (!execute) { showToast([text.saved]); return; }
    const parent = missionById(parentId);
    if (parent && parentVariant === 'basic' && [26, 27, 30].includes(Number(parent.id.slice(1))) && entries.length < 2) { setError(text.twoNeeded); return; }
    let ok = false; store.update(s => { ok = startDayMission(s, todayKey(), category, entries[daySelected]?.id, dayVariant, true, parentId, parentVariant); });
    if (ok) closeModal(); else setError(text.noMatch);
  };
  const finish = () => {
    if (!session) { closeModal(); return; }
    const nextBookmark = bookmarkSuggestion(state);
    let rewarded = false; store.update(s => { rewarded = closeMissionSession(s, todayKey(), session.sessionId, chips); });
    if (rewarded) { events.emit('celebrate', { item: null }); showToast([text.sessionPacket]); }
    if (nextBookmark) { setBookmark(nextBookmark); setHistory([]); setScreen('bookmark'); } else closeModal();
  };
  const more = () => {
    if (!last || limitReached(state, todayKey())) return;
    const current = missionById(last.missionId);
    if (last.variant === 'small' && current?.mode === 'activity' && !session?.reportedActions.some(a => a.missionId === last.missionId && a.variant === 'basic')) openCard(current);
    else if (current?.recommendation.afterFinal) { setParentId(undefined); go('day'); }
    else { const next = missionCandidates(p, { after: last.missionId })[0]; if (next) openCard(next); else go('menu'); }
  };
  const field = (key: keyof Draft, label: string, multiline = false) => <label className="mission-field"><span>{label}</span>{multiline
    ? <textarea className="text-input" maxLength={160} rows={2} value={draft[key] ?? ''} onChange={e => setDraft(x => ({ ...x, [key]: e.target.value }))} />
    : <input className="text-input" maxLength={key === 'name' ? 80 : 160} value={draft[key] ?? ''} onChange={e => setDraft(x => ({ ...x, [key]: e.target.value }))} />}</label>;
  const perPage = 4;
  let title = text.title as string;
  let content: ReactNode;

  if (screen === 'category') {
    title = text.categoryTitle;
    content = <><p className="panel-note">{text.categoryNote}</p><div className="mission-grid">{categories.map(id => <Button key={id} onClick={() => selectCategory(id)}>{text.categories[id]}</Button>)}</div><Button onClick={() => { edit(x => { x.onboardingSeen = true; }); closeModal(); }}>{text.garden}</Button></>;
  } else if (screen === 'context') {
    title = text.context;
    content = category === 'work' ? <><div className="mission-grid">{(['pre_return', 'returned', 'unknown'] as const).map(status => <Button key={status} onClick={() => { edit(x => { x.workStatus = status; x.selectedIntent = 'work'; }); go('work'); }}>{text.workStatus[status]}</Button>)}</div><Button onClick={() => go('menu')}>{text.menu}</Button></>
      : <><div className="mission-grid">{(category === 'academic' ? ['course', 'assignment', 'exam'] : (allScenes ? ['drink', 'meal', 'wash', 'clothes', 'space', 'observe', 'outing', 'rest', 'contact'] : ['drink', 'meal', 'wash'])).map(intent => <Button key={intent} onClick={() => chooseIntent(intent)}>{text.intents[intent as keyof typeof text.intents]}</Button>)}</div><div className="btn-pair">{category === 'daily' && <Button onClick={() => setAllScenes(x => !x)}>{allScenes ? text.fewerScenes : text.moreScenes}</Button>}<Button onClick={() => go('menu')}>{text.menu}</Button><Button onClick={rest}>{text.rest}</Button></div></>;
  } else if (screen === 'academic') {
    title = text.situations;
    const choices = [[text.findMaterial, 'A01'], [text.openMaterial, 'A03'], [text.readyMaterial, p.selectedIntent === 'exam' ? 'A07' : p.selectedIntent === 'assignment' ? 'A09' : 'A06']];
    content = <div className="mission-grid">{choices.map(([label, id]) => <Button key={id} onClick={() => openCard(missionById(id)!)}>{label}</Button>)}</div>;
  } else if (screen === 'work') {
    const choices = p.workStatus === 'returned' ? [[text.workMaterial, 'W06'], [text.workRequest, 'W07'], [text.personalPrep, 'W03']] : [[text.returnNotice, 'W01'], [text.personalPrep, 'W03']];
    content = <><div className="mission-grid">{choices.map(([label, id]) => <Button key={id} onClick={() => openCard(missionById(id)!)}>{label}</Button>)}</div><Button onClick={() => go('menu')}>{text.menu}</Button></>;
  } else if (screen === 'menu') {
    const next = suggested();
    content = <><p className="panel-note">{category ? text.categories[category] : text.categoryNote} · {text.stageNote}</p>
      {session && session.reportedActions.length > 0 && <Button primary onClick={() => go('after')}>{text.resumeSession}</Button>}
      {p.execution && <Button primary onClick={closeModal}>{text.keepExecution}</Button>}
      <div className="mission-grid">
        {category === 'daily' && !p.selectedIntent ? ['D01', 'D03', 'D05'].map(id => missionById(id)!).filter(item => ['basic', 'small'].some(v => missionEligibility(p, item, v as MissionVariant) !== 'excluded')).map(item => <Button key={item.id} primary disabled={limitReached(state, todayKey())} onClick={() => openCard(item)}>{item.name}</Button>)
          : <Button primary disabled={!next || limitReached(state, todayKey())} onClick={() => next && openCard(next)}>{text.choose}</Button>}
        <Button onClick={() => go('context')}>{text.context}</Button>
        {category && p.bookmarks[category] && <Button onClick={() => { setBookmark(p.bookmarks[category]!); go('resume'); }}>{text.resume}</Button>}
        <Button onClick={openDay}>{text.myDay}</Button>
        <Button onClick={() => { setDayPickIndex(null); go('customList'); }}>{text.myCustom}</Button>
        <Button onClick={() => openCatalog('card')}>{text.all}</Button><Button onClick={() => go('category')}>{text.category}</Button>
        <Button onClick={rest}>{text.rest}</Button>
      </div></>;
  } else if ((screen === 'card' || screen === 'stage') && m) {
    title = m.name;
    content = screen === 'stage' ? <><p className="panel-message">{text.stage(m.stage, m.stageName)}</p><p className="panel-note">{text.stageQuestion}</p><div className="btn-pair"><Button primary onClick={() => { store.update(s => chooseMissionStage(s, m)); go('card'); }}>{text.stageAccept}</Button><Button onClick={() => go('menu')}>{text.practice}</Button></div></>
      : <><p className="panel-note">{m.npc}: {m.dialogue}</p><p className="mission-condition">{m.conditionSummary}</p>
        <div className="mission-variants">{(['basic', 'small'] as const).map(variant => <div className="mission-variant" key={variant}><strong>{text[variant]}</strong><p>{m[variant]}</p><Button primary disabled={missionEligibility(p, m, variant) === 'excluded' || limitReached(state, todayKey())} onClick={() => startVariant(variant)}>{variant === 'basic' ? text.startBasic : text.startSmall}</Button></div>)}</div>
        <div className="btn-pair"><Button onClick={() => go('options')}>{text.otherChoices}</Button><Button onClick={rest}>{text.rest}</Button></div></>;
  } else if (screen === 'options') {
    title = text.otherChoices;
    content = <div className="mission-grid two"><Button onClick={() => go('alternatives')}>{text.other}</Button>
      {m && [...m.eligibility.basicRequiredFacts, ...m.eligibility.smallRequiredFacts].length > 0 && <Button onClick={() => go('conditions')}>{text.editConditions}</Button>}
      <Button onClick={() => { const next = missionCandidates(p, { allStages: true }).find(item => item.stage > p.stages[item.categoryId]); if (next) openCard(next); else go('menu'); }}>{text.tooEasy}</Button>
      <Button onClick={() => go('menu')}>{text.tools}</Button></div>;
  } else if (screen === 'execution' && p.execution) {
    const x = p.execution; const c = p.custom.find(item => item.id === x.customId); const mission = missionById(x.missionId);
    content = <><p className="mission-action">{x.text}</p><p className="panel-note">{mission?.conditionSummary}</p><p className="panel-note">{text.small}: {c?.small ?? mission?.small}</p><div className="btn-pair">{x.variant !== 'small' && <Button onClick={() => { let ok = false; store.update(s => { ok = reduceMission(s, todayKey(), true); }); if (ok) closeModal(); else setError(text.noMatch); }}>{text.startSmall}</Button>}<Button primary onClick={closeModal}>{text.keepExecution}</Button><Button onClick={rest}>{text.rest}</Button></div></>;
  } else if (screen === 'conditions' && m) {
    const keys = [...new Set([...m.eligibility.basicRequiredFacts, ...m.eligibility.smallRequiredFacts])];
    title = text.condition;
    content = <><p className="panel-note">{m.condition}</p><div className="mission-facts">{keys.slice(page * 4, (page + 1) * 4).map(key => <label className="mission-field" key={key}><span>{text.facts[key as keyof typeof text.facts]}</span><select className="text-input" value={String(p.facts[key] ?? 'unknown')} onChange={e => store.update(s => setMissionFact(s, key, e.target.value === 'unknown' ? 'unknown' : e.target.value === 'true'))}><option value="unknown">{text.factValues.unknown}</option><option value="true">{text.factValues.yes}</option><option value="false">{text.factValues.no}</option></select></label>)}</div><div className="btn-pair">{keys.length > 4 && <><Button disabled={page === 0} onClick={() => setPage(x => x - 1)}>{text.earlier}</Button><Button disabled={(page + 1) * 4 >= keys.length} onClick={() => setPage(x => x + 1)}>{text.later}</Button></>}</div></>;
  } else if (screen === 'alternatives') {
    const options = missionCandidates(p, { exclude: selectedId ? [selectedId] : [] }).slice(0, 2);
    content = <><p className="panel-note">{text.conditionNote}</p>{options.map(item => <Button key={item.id} onClick={() => openCard(item)}>{item.name} · {item.conditionSummary}</Button>)}{!options.length && <p className="panel-note">{text.noMatch}</p>}<div className="btn-pair"><Button onClick={create}>{text.custom}</Button><Button onClick={() => go('context')}>{text.context}</Button><Button onClick={() => go('category')}>{text.category}</Button></div></>;
  } else if (screen === 'catalog') {
    title = text.all;
    const list = missions.filter(item => item.categoryId === category && (catalogTarget !== 'editor' || (item.mode === 'activity' && !item.eligibility.inheritCustomActionRequirements && ['basic', 'small'].some(v => missionEligibility(p, item, v as MissionVariant) !== 'excluded'))));
    content = <><div className="mission-grid two">{list.slice(page * perPage, (page + 1) * perPage).map(item => <Button key={item.id} disabled={item.categoryId === 'work' && item.eligibility.allowedWorkStatuses.length > 0 && !item.eligibility.allowedWorkStatuses.includes(p.workStatus)} onClick={() => catalogTarget === 'editor' ? copyCard(item) : openCard(item)}>{item.id} · {item.name}</Button>)}</div><div className="btn-pair">{list.length > perPage && <><Button disabled={page === 0} onClick={() => setPage(x => x - 1)}>{text.earlier}</Button><Button disabled={(page + 1) * perPage >= list.length} onClick={() => setPage(x => x + 1)}>{text.later}</Button></>}</div></>;
  } else if (screen === 'editor' || screen === 'editorMore') {
    title = text.custom;
    content = screen === 'editor' ? <><p className="panel-note">{missionById(draft.sourceMissionId)?.conditionSummary ?? text.privateNote}</p>{field('name', text.name)}<div className="mission-variants">{field('basic', text.action, true)}{field('small', text.smaller, true)}</div><div className="btn-pair"><Button onClick={() => openCatalog('editor')}>{text.copy}</Button><Button onClick={() => go('editorMore')}>{text.editMore}</Button></div>
      <div className="btn-pair"><Button onClick={() => saveDraft(false)}>{dayPickIndex !== null ? text.savePlace : text.saveOnly}</Button>{dayPickIndex === null && <Button primary disabled={limitReached(state, todayKey())} onClick={() => saveDraft(true)}>{text.execute}</Button>}</div></>
      : <>{field('trigger', text.trigger)}{field('criterion', text.criterion, true)}<div className="btn-pair">{(['basic', 'small'] as const).map(v => <button key={v} className="btn btn-secondary" aria-pressed={editorVariant === v} onClick={() => setEditorVariant(v)}>{text[v]}</button>)}</div></>;
  } else if (screen === 'customList' || screen === 'dayPick') {
    title = text.myCustom; const list = p.custom.filter(c => c.categoryId === category);
    content = <>{!list.length && <p className="panel-note">{text.noCustom}</p>}<div className="mission-grid two">{list.slice(page * perPage, (page + 1) * perPage).map(c => <Button key={c.id} onClick={() => {
      if (screen === 'dayPick' && dayPickIndex !== null) { setEntries(old => old.map((e, i) => i === dayPickIndex ? { ...e, customId: c.id } : e)); setDayPickIndex(null); go('day'); }
      else { setEditId(c.id); setParentId(undefined); setDraft({ ...c }); go('editor'); }
    }}>{c.name}</Button>)}</div><div className="btn-pair">{list.length > perPage && <><Button disabled={page === 0} onClick={() => setPage(x => x - 1)}>{text.earlier}</Button><Button disabled={(page + 1) * perPage >= list.length} onClick={() => setPage(x => x + 1)}>{text.later}</Button></>}<Button onClick={() => { setEditId(undefined); setDraft(emptyDraft()); go('editor'); }}>{text.custom}</Button></div></>;
  } else if (screen === 'day') {
    title = text.myDay;
    const selectedCustom = p.custom.find(c => c.id === entries[daySelected]?.customId);
    content = <><p className="panel-note">{missionById(selectedCustom?.sourceMissionId)?.conditionSummary ?? text.dayNote}</p><div className={`mission-day${dayEditing ? " is-editing" : ""}`}>{entries.map((entry, i) => <div className="mission-day-row" key={entry.id}>
      <input type="radio" aria-label={text.dayExecute} name="day-choice" checked={daySelected === i} onChange={() => setDaySelected(i)} />
      <button className="btn btn-secondary" onClick={() => { setDayPickIndex(i); go('dayPick'); }}>{p.custom.find(c => c.id === entry.customId)?.name ?? text.chooseCustom}</button>
      <select className="text-input" aria-label={text.trigger} value={entry.cue} onChange={e => setEntries(old => old.map((v, j) => j === i ? { ...v, cue: e.target.value } : v))}>{text.cues.map(cue => <option key={cue}>{cue}</option>)}</select>
      {dayEditing && <><button className="btn-chip" disabled={i === 0} onClick={() => { setEntries(old => { const next = old.slice(); [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next; }); setDaySelected(i - 1); }}>{text.up}</button>
      <button className="btn-chip" disabled={entries.length === 1} onClick={() => { setEntries(old => old.filter((_, j) => j !== i)); setDaySelected(0); }}>{text.delete}</button></>}
    </div>)}</div>{dayEditing && <div className="btn-pair"><Button disabled={entries.length <= 1} onClick={() => { setEntries(old => old.slice(0, -1)); setDaySelected(0); setParentVariant('small'); }}>{text.dayReduced}</Button><Button disabled={entries.length >= 3} onClick={() => setEntries(old => [...old, { id: crypto.randomUUID(), customId: '', cue: text.cues[1] }])}>{text.addThird}</Button><Button onClick={() => go('dayOptions')}>{text.optional}</Button></div>}
      <div className="btn-pair"><Button onClick={() => go('menu')}>{text.tools}</Button><Button onClick={() => setDayEditing(x => !x)}>{dayEditing ? text.editDone : text.editDay}</Button>{dayEditing && <Button onClick={() => saveDay(false)}>{text.daySave}</Button>}<Button primary disabled={limitReached(state, todayKey()) || (!!selectedCustom && customEligibility(p, selectedCustom, dayVariant) === 'excluded')} onClick={() => saveDay(true)}>{text.dayExecute}</Button></div></>;
  } else if (screen === 'dayOptions') {
    const entry = entries[daySelected]; title = text.optional;
    content = <>{entry && <div className="mission-variants"><label className="mission-field"><span>{text.time}</span><input className="text-input" maxLength={100} value={entry.time ?? ''} onChange={e => setEntries(old => old.map((v, i) => i === daySelected ? { ...v, time: e.target.value } : v))} /></label><label className="mission-field"><span>{text.place}</span><input className="text-input" maxLength={100} value={entry.place ?? ''} onChange={e => setEntries(old => old.map((v, i) => i === daySelected ? { ...v, place: e.target.value } : v))} /></label></div>}
      <label className="mission-field"><span>{text.restCue}</span><input className="text-input" maxLength={100} value={restCue} onChange={e => setRestCue(e.target.value)} /></label><div className="btn-pair">{(['basic', 'small'] as const).map(v => <button key={v} className="btn btn-secondary" aria-pressed={dayVariant === v} onClick={() => setDayVariant(v)}>{text[v]}</button>)}</div></>;
  } else if (screen === 'after') {
    content = <><p className="panel-note">{text.report}</p><p className="mission-action">{last?.record}</p><p className="panel-note">{text.sessionNote}</p><div className="chips">{(['achieved', 'easier', 'again'] as const).map(chip => <button key={chip} className={`chip${chips.includes(chip) ? ' chip-on' : ''}`} aria-pressed={chips.includes(chip)} onClick={() => {
      const next = chips.includes(chip) ? chips.filter(x => x !== chip) : [...chips, chip]; setChips(next);
      store.update(s => { const log = s.logs.find(l => l.id === last?.logId); if (log) log.chips = next; });
    }}>{copy.reflect[chip]}</button>)}</div>
      <div className="btn-pair"><Button disabled={!last || limitReached(state, todayKey())} onClick={more}>{text.more}</Button><Button primary onClick={finish}>{text.finish}</Button></div></>;
  } else if ((screen === 'bookmark' || screen === 'resume') && bookmark) {
    title = text.bookmark;
    const target = missionById(bookmark.targetMissionId ?? bookmark.sourceMissionId);
    content = <><p className="panel-note">{screen === 'bookmark' ? text.bookmarkNote : target?.condition}</p>
      {screen === 'bookmark' ? <><label className="mission-field"><span>{text.bookmarkAction}</span><textarea className="text-input" rows={2} maxLength={160} value={bookmark.nextAction} onChange={e => setBookmark(x => x && ({ ...x, nextAction: e.target.value }))} /></label><label className="mission-field"><span>{text.location}</span><input className="text-input" maxLength={100} value={bookmark.locationLabel ?? ''} onChange={e => setBookmark(x => x && ({ ...x, locationLabel: e.target.value }))} /></label><div className="btn-pair"><Button primary disabled={!bookmark.nextAction.trim()} onClick={() => { store.update(s => saveMissionBookmark(s, bookmark)); closeModal(); }}>{text.saveBookmark}</Button><Button onClick={closeModal}>{text.noBookmark}</Button></div></>
        : <><p className="mission-action">{bookmark.nextAction}</p>{target && target.stage > p.stages[target.categoryId] && <p className="panel-note">{text.stageQuestion}</p>}<Button primary disabled={limitReached(state, todayKey()) || (!!target && missionEligibility(p, target, 'small') === 'excluded')} onClick={() => { let ok = false; store.update(s => { if (target) chooseMissionStage(s, target); ok = resumeMissionBookmark(s, todayKey(), bookmark.categoryId, true); }); if (ok) closeModal(); else setError(text.noMatch); }}>{text.resumeAction}</Button><Button onClick={() => go('menu')}>{text.other}</Button></>}
    </>;
  } else content = <p className="panel-note">{text.noMatch}</p>;

  return <section className={`panel mission-panel mission-screen-${screen}`} role="dialog" aria-label={title}>
    <PanelHead title={title} left={history.length > 0 ? <IconBtn name="back" label={text.back} onClick={back} /> : undefined} />
    {content}{error && <p className="panel-note" role="status">{error}</p>}
  </section>;
}

export const openMissionPanel = (after = false, details = false) => openModal(<MissionPanel after={after} details={details} />);
