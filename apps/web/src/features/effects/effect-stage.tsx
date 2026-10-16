import Phaser from "phaser";
import { useEffect, useRef } from "react";

import { FfrkEffectPlayer, loadEffect, type EffectPhase } from "./ffrk-effect";

/** A target to play effects on: the Bomb's FFRK sprite (first cell of its strip). */
const TARGET_URL = "/sprites/enemies/enemy-109010.png";

class StageScene extends Phaser.Scene {
  player?: FfrkEffectPlayer;
  private token = 0;
  constructor() {
    super("effect-stage");
  }
  preload() {
    this.load.spritesheet("stage-target", TARGET_URL, { frameWidth: 64, frameHeight: 64 });
  }
  create() {
    this.add.sprite(this.scale.width / 2, this.scale.height / 2, "stage-target", 0).setScale(3);
    this.game.events.emit("stage-ready");
  }
  async show(id: number | null, phase: EffectPhase, speed: number) {
    const token = ++this.token;
    this.player?.destroy();
    this.player = undefined;
    if (id == null) return;
    const asset = await loadEffect(this, id, phase);
    if (!asset || token !== this.token) return;
    this.player = new FfrkEffectPlayer(this, asset, { x: this.scale.width / 2, y: this.scale.height / 2, scale: 3, loop: true, speed });
  }
}

/** A Phaser stage looping one FFRK effect on a target. */
export function EffectStage({ id, phase, speed = 1, className }: { id: number | null; phase: EffectPhase; speed?: number; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<StageScene | null>(null);
  const want = useRef({ id, phase, speed });
  want.current = { id, phase, speed };

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      backgroundColor: "#1b2140",
      pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE },
      scene: [StageScene],
    });
    game.events.once("stage-ready", () => {
      scene.current = game.scene.getScene("effect-stage") as StageScene;
      void scene.current.show(want.current.id, want.current.phase, want.current.speed);
    });
    return () => {
      scene.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    void scene.current?.show(id, phase, speed);
  }, [id, phase, speed]);

  return <div ref={host} className={className} />;
}
