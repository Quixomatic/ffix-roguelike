import Phaser from "phaser";
import { useEffect, useRef } from "react";

import { assetUrl } from "@/lib/assets";

import { FfrkEffectPlayer, loadEffect } from "./ffrk-effect";

/** A target to play effects on: the Bomb's FFRK sprite (first cell of its strip). */
const TARGET_URL = "sprites/enemies/enemy-109010.png";

class StageScene extends Phaser.Scene {
  player?: FfrkEffectPlayer;
  private token = 0;
  private target?: Phaser.GameObjects.Sprite;
  private showing: { path: string | null; speed: number } = { path: null, speed: 1 };
  constructor() {
    super("effect-stage");
  }
  preload() {
    this.load.spritesheet("stage-target", assetUrl(TARGET_URL), { frameWidth: 64, frameHeight: 64 });
  }
  create() {
    this.target = this.add.sprite(this.scale.width / 2, this.scale.height / 2, "stage-target", 0).setScale(3);
    // The stage follows its panel's size: keep the target and the effect centred.
    this.scale.on(Phaser.Scale.Events.RESIZE, () => {
      this.target?.setPosition(this.scale.width / 2, this.scale.height / 2);
      void this.show(this.showing.path, this.showing.speed);
    });
    this.game.events.emit("stage-ready");
  }
  async show(path: string | null, speed: number) {
    const token = ++this.token;
    this.showing = { path, speed };
    this.player?.destroy();
    this.player = undefined;
    if (path == null) return;
    const asset = await loadEffect(this, path);
    if (!asset || token !== this.token) return;
    this.player = new FfrkEffectPlayer(this, asset, { x: this.scale.width / 2, y: this.scale.height / 2, scale: 3, loop: true, speed });
  }
}

/** A Phaser stage looping one FFRK effect rig (server path, e.g. "ab/ability/11000/11000_hit.json") on a target. */
export function EffectStage({ path, speed = 1, className }: { path: string | null; speed?: number; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<StageScene | null>(null);
  const want = useRef({ path, speed });
  want.current = { path, speed };

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
      void scene.current.show(want.current.path, want.current.speed);
    });
    return () => {
      scene.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    void scene.current?.show(path, speed);
  }, [path, speed]);

  return <div ref={host} className={className} />;
}
