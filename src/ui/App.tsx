// 정원 위에 겹치는 모든 화면의 뿌리. #ui 바로 아래에 이 요소들이 나란히 놓인다.
import { useEffect } from 'react';
import { startAccountData } from '@/lib/gardenSync';
import { SaveStatus } from './panels/Account';
import { DecorateBar } from './panels/Decorate';
import { Hud } from './Hud';
import { Joystick } from './Joystick';
import { ModalHost } from './modal';
import { Rotate } from './Rotate';
import { ToastHost } from './toast';
import { Zoom } from './Zoom';

export function App({ stage }: { stage: HTMLElement }) {
  useEffect(startAccountData, []);
  return (
    <>
      <Hud />
      <SaveStatus />
      <Joystick />
      <Zoom stage={stage} />
      <DecorateBar />
      <ModalHost />
      <ToastHost />
      <Rotate />
    </>
  );
}
