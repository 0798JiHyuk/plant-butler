import { useEffect, useRef, useState } from 'react';
import { copy } from '@/core/copy';
import { photoPolicy } from '@/core/photoCheck';
import { checkActivityPhoto, type PhotoCheckResult } from '@/lib/photoCheck';
import { cameraFrame, stopCamera } from '@/ui/camera';
import { openModal } from '@/ui/modal';
import { PanelHead } from './PanelHead';

type Phase = 'ready' | 'opening' | 'live' | 'preview' | 'checking' | 'cameraError' | PhotoCheckResult;

function PhotoCheck({ activityId, onContinue }: { activityId: string; onContinue: () => void }) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [image, setImage] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const cameraTimer = useRef<ReturnType<typeof setTimeout>>();
  const busy = useRef(false);
  const done = useRef(false);
  const text = copy.photo;
  const stop = () => { stopCamera(stream.current); stream.current = null; };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; sequence.current++; clearTimeout(cameraTimer.current);
      request.current?.abort(); stop();
    };
  }, []);

  const start = async () => {
    if (busy.current || done.current) return;
    busy.current = true; const ticket = ++sequence.current;
    stop(); setImage(null); setPhase('opening');
    const current = () => alive.current && sequence.current === ticket;
    cameraTimer.current = setTimeout(() => {
      if (!current()) return;
      sequence.current++; busy.current = false; stop(); setPhase('cameraError');
    }, 12000);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
      const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1024 }, height: { ideal: 768 } } });
      if (!current()) { stopCamera(next); return; }
      stream.current = next;
      if (!video.current) throw new Error('Video unavailable');
      video.current.srcObject = next;
      await video.current.play();
      if (!current()) return;
      setPhase('live');
    } catch { if (current()) { stop(); setPhase('cameraError'); } }
    finally { if (current()) { clearTimeout(cameraTimer.current); busy.current = false; } }
  };
  const capture = () => {
    try {
      if (!video.current) throw new Error('Video unavailable');
      setImage(cameraFrame(video.current)); stop(); setPhase('preview');
    } catch { stop(); setPhase('cameraError'); }
  };
  const submit = async () => {
    if (busy.current || done.current || !image) return;
    busy.current = true; const ticket = ++sequence.current;
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setPhase('checking');
    try {
      const result = await checkActivityPhoto(activityId, image, controller.signal);
      if (alive.current && sequence.current === ticket) { setImage(null); setPhase(result); }
    } finally {
      clearTimeout(timeout);
      if (sequence.current === ticket) { request.current = null; busy.current = false; }
    }
  };
  const finish = () => {
    if (done.current) return;
    done.current = true; sequence.current++; request.current?.abort();
    clearTimeout(cameraTimer.current); stop(); setImage(null); onContinue();
  };
  const result = ['matched', 'not_matched', 'uncertain', 'unavailable', 'cameraError'].includes(phase);
  return <section className="panel photo-check" role="dialog" aria-label={text.title} aria-busy={phase === 'checking'}>
    <PanelHead title={text.title} />
    <p className="panel-note">{text.hints[activityId as keyof typeof text.hints]}</p>
    <p className="panel-note" role="status">{phase === 'ready' ? text.notice : text[phase]}</p>
    <video ref={video} autoPlay muted playsInline hidden={phase !== 'live' && phase !== 'opening'} className="photo-camera" aria-label={text.live} />
    {image && <img className="photo-camera" src={image} alt={text.preview} />}
    {phase === 'ready' && <p className="panel-note">{text.privacy}</p>}
    <div className="btn-pair">
      {(phase === 'ready' || phase === 'cameraError') && <button className="btn btn-primary" onClick={() => void start()}>{text.start}</button>}
      {phase === 'live' && <button className="btn btn-primary" onClick={capture}>{text.capture}</button>}
      {phase === 'preview' && <>
        <button className="btn btn-secondary" onClick={() => void start()}>{text.retry}</button>
        <button className="btn btn-primary" onClick={() => void submit()}>{text.submit}</button>
      </>}
      {result && phase !== 'cameraError' && phase !== 'matched' && <button className="btn btn-secondary" onClick={() => void start()}>{text.retry}</button>}
      <button className="btn btn-secondary" onClick={finish}>{phase === 'matched' ? text.next : text.skip}</button>
    </div>
  </section>;
}

export function openPhotoCheck(activityId: string, onContinue: () => void): void {
  if (!photoPolicy(activityId)) { onContinue(); return; }
  openModal(<PhotoCheck activityId={activityId} onContinue={onContinue} />);
}
