import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import './EquipmentAnimation.css';

type BlockProps = {
  x: number;
  y: number;
  z?: number;
  width: number;
  depth: number;
  height: number;
  className?: string;
  children?: ReactNode;
};
function Block({ x, y, z = 0, width, depth, height, className = '', children }: BlockProps) {
  const style = {
    '--x': x + 'px',
    '--y': y + 'px',
    '--z': z + 'px',
    '--w': width + 'px',
    '--d': depth + 'px',
    '--h': height + 'px',
  } as CSSProperties;
  return (
    <div className={'room-block ' + className} style={style}>
      <div className="block-top" />
      <div className="block-front">{children}</div>
      <div className="block-right" />
    </div>
  );
}
function Desk({ x, y }: { x: number; y: number }) {
  return (
    <>
      {[0, 1].map((a) =>
        [0, 1].map((b) => (
          <Block
            key={a + '-' + b}
            x={x + 4 + a * 51}
            y={y + 3 + b * 30}
            width={4}
            depth={4}
            height={38}
            className="desk-leg"
          />
        )),
      )}
      <Block x={x} y={y} z={38} width={62} depth={40} height={5} className="desk-top" />
      <Block x={x + 39} y={y + 8} z={43} width={15} depth={20} height={2} className="notebook" />
      <Block x={x + 17} y={y + 53} z={24} width={29} depth={25} height={4} className="chair-seat" />
      <Block x={x + 17} y={y + 74} z={28} width={29} depth={4} height={23} className="chair-back" />
      <Block x={x + 20} y={y + 57} width={4} depth={4} height={24} className="desk-leg" />
      <Block x={x + 39} y={y + 72} width={4} depth={4} height={24} className="desk-leg" />
    </>
  );
}
export default function EquipmentAnimation() {
  const [paused, setPaused] = useState(false);
  return (
    <figure className={'entry-visual' + (paused ? ' entry-visual-paused' : '')}>
      <div className="classroom-scene" aria-hidden="true">
        <div className="classroom-world">
          <div className="classroom-floor">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} style={{ left: i * 60 }} />
            ))}
          </div>
          <div className="classroom-floor-front" />
          <div className="classroom-floor-side" />
          <div className="classroom-wall-back">
            <div className="classroom-board">
              <i />
              <i />
              <i />
              <span />
            </div>
            <div className="wall-trim" />
          </div>
          <div className="classroom-wall-side">
            <div className="classroom-window window-one">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="classroom-window window-two">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="wall-trim" />
          </div>
          <Desk x={143} y={52} />
          <Desk x={278} y={52} />
          <Desk x={143} y={161} />
          <Desk x={278} y={161} />
          <Block x={346} y={20} width={72} depth={32} height={48} className="classroom-cabinet" />
          <Block x={352} y={24} z={48} width={19} depth={22} height={5} className="notebook" />
          <Block x={378} y={25} z={48} width={22} depth={19} height={3} className="desk-top" />
          <Block x={52} y={180} width={40} depth={31} height={70} className="room-purifier">
            <div className="purifier-panel">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} />
              ))}
              <b />
            </div>
          </Block>
          <div className="purifier-outlet">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      </div>
      <figcaption>
        <span>Classroom illustration</span>
        <button type="button" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
          {paused ? 'Play animation' : 'Pause animation'}
        </button>
      </figcaption>
    </figure>
  );
}
