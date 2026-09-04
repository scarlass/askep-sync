/* ==========================================================================
   import/shared.js — pembantu kecil bersama antar modul impor
   ========================================================================== */

import { makeComponent } from "../model.js";

/* Satu komponen model + tambalan properti (dipakai semua modul impor). */
export const comp = (type, patch) => ({ ...makeComponent(type), ...patch });

/* Batas kolom satu baris model. */
export const MAX_COLS = 6;
