import { runFestivalData } from '../festival-data.mjs';

export async function worker({ root, defaultBranch, context, deliver, log }) {
  await runFestivalData({ mode: 'refresh', stampsCount: false, root, defaultBranch, context, deliver, log });
}
