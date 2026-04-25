import bgPistol from "@/assets/qa-arsenal/bg-pistol.jpg";
import bgRifle from "@/assets/qa-arsenal/bg-rifle.jpg";
import bgShotgun from "@/assets/qa-arsenal/bg-shotgun.jpg";
import bgRevolver from "@/assets/qa-arsenal/bg-revolver.jpg";
import wPistol from "@/assets/qa-arsenal/weapon-pistol.png";
import wRevolver from "@/assets/qa-arsenal/weapon-revolver.png";
import wShotgun from "@/assets/qa-arsenal/weapon-shotgun.png";
import wRifle from "@/assets/qa-arsenal/weapon-rifle.png";
import wCarbine from "@/assets/qa-arsenal/weapon-carbine.png";
import type { WeaponKind } from "./utils";

export function backgroundForKind(kind: WeaponKind): string {
  switch (kind) {
    case "pistola":
    case "submetralhadora":
      return bgPistol;
    case "fuzil":
    case "carabina":
      return bgRifle;
    case "espingarda":
      return bgShotgun;
    case "revolver":
      return bgRevolver;
    default:
      return bgRifle;
  }
}

export function renderForKind(kind: WeaponKind): string {
  switch (kind) {
    case "pistola":
    case "submetralhadora":
      return wPistol;
    case "revolver":
      return wRevolver;
    case "espingarda":
      return wShotgun;
    case "fuzil":
      return wRifle;
    case "carabina":
      return wCarbine;
    default:
      return wPistol;
  }
}