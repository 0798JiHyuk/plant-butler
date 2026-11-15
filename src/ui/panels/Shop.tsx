// 모루의 작업대: 열매로 꾸미기 소품을 산다. 사지 않아도 이야기는 그대로 이어진다.
import { useRef, useState } from 'react';
import { SHOP } from '../../core/economy';
import { copy } from '../../core/copy';
import { events } from '../../core/events';
import { purchaseOnce } from '../../core/decoration';
import { saveProgress } from '../saveProgress';
import { openDecorationPreview } from './DecorationPreview';
import { PropImg } from '../icons';
import { openModal } from '../modal';
import { useAppState } from '../useAppState';
import { PanelHead } from './PanelHead';
import { withinReach,SHOP_RANGE } from '../../core/interaction';
import { LANDMARKS } from '../../core/worldGeometry';
import { currentPosition } from '../worldPosition';
import { showToast,clearToast } from '../toast';

function Shop() {
  const s = useAppState();
  const { fruit } = s;
  const requests=useRef<Record<string,string>>({});
  const [say, setSay] = useState<string>(copy.shop.intro);
  return (
    <section className="panel shop" role="dialog" aria-label={copy.shop.title}>
      <PanelHead title={copy.shop.title} />
      <div className="shop-top">
        <p className="shop-say">{say}</p>
        <strong className="shop-balance">{copy.shop.balance(fruit)}</strong>
      </div>
      <ul className="shop-grid">
        {SHOP.map((item) => {
          const canBuy = fruit >= item.price;
          const name = copy.decorate.kind[item.kind];
          return (
            <li className="shop-card" key={item.kind}>
              <span className="shop-img"><PropImg kind={item.kind} /></span>
              <strong>{name}</strong>
              <button type="button" className="btn-chip" onClick={()=>openDecorationPreview(item.kind,openShop,openShop)}>{copy.map.preview}</button>
              <button
                type="button"
                className={canBuy ? 'btn-chip btn-chip-primary' : 'btn-chip'}
                aria-label={`${name} ${copy.shop.price(item.price)}`}
                onClick={() => {
                  // 모자라면 사지 않고 모루의 말만 바뀐다(살 수 없는 버튼도 눌러 볼 수 있게 둔다).
                  if (fruit < item.price) return setSay(copy.shop.poor);
                  const requestId=requests.current[item.kind]??=crypto.randomUUID();
                  let result='unknown';
                  if(!saveProgress(d=>{result=purchaseOnce(d,item.kind,requestId);})||result!=='ok')return;
                  // A new purchase requires reopening the shop; repeated taps are this same intent.

                  events.emit('sfx', { name: 'buy' });
                  setSay(copy.lines.bought);
                }}
              >
                {canBuy ? `${copy.shop.buy} · ${copy.shop.price(item.price)}` : copy.shop.price(item.price)}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const openShop = () => {
  const p=currentPosition();
  if(p.indoor||!withinReach(p,LANDMARKS.shop,SHOP_RANGE)){showToast([copy.world.shopWalk]);return;}
  clearToast();
  openModal(<Shop />);
};
