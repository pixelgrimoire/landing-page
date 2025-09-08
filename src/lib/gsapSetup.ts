"use client";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

// Plugins incluidos en el paquete estándar de gsap
import { CustomEase } from "gsap/CustomEase";
import { CustomBounce } from "gsap/CustomBounce"; // requiere CustomEase
import { CustomWiggle } from "gsap/CustomWiggle"; // requiere CustomEase
import { RoughEase, ExpoScaleEase, SlowMo } from "gsap/EasePack";

import { Draggable } from "gsap/Draggable";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { EaselPlugin } from "gsap/EaselPlugin";
import { Flip } from "gsap/Flip";
import { GSDevTools } from "gsap/GSDevTools";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { MotionPathHelper } from "gsap/MotionPathHelper";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { Observer } from "gsap/Observer";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";
import { PhysicsPropsPlugin } from "gsap/PhysicsPropsPlugin";
import { PixiPlugin } from "gsap/PixiPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother"; // requiere ScrollTrigger
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { SplitText } from "gsap/SplitText";
import { TextPlugin } from "gsap/TextPlugin";

let registered = false;

export function setupGSAP() {
  if (registered || typeof window === "undefined") return gsap;
  try {
    gsap.registerPlugin(
      // Core/React
      useGSAP,
      // Timeline helpers / Eases
      RoughEase,
      ExpoScaleEase,
      SlowMo,
      CustomEase,
      CustomBounce,
      CustomWiggle,
      // Core plugins
      Draggable,
      Flip,
      MotionPathPlugin,
      Observer,
      ScrollTrigger,
      ScrollToPlugin,
      TextPlugin,
      // Bonus (ahora incluidos)
      DrawSVGPlugin,
      EaselPlugin,
      GSDevTools,
      InertiaPlugin,
      MotionPathHelper,
      MorphSVGPlugin,
      Physics2DPlugin,
      PhysicsPropsPlugin,
      PixiPlugin,
      ScrambleTextPlugin,
      ScrollSmoother,
      SplitText,
    );
  } catch {
    // silencioso: gsap.registerPlugin es idempotente y seguro
  }
  registered = true;
  return gsap;
}

export { gsap };
