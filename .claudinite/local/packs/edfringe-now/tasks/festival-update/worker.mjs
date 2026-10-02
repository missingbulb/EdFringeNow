import { runFestivalData } from '../festival-data.mjs';

export async function worker({ root, defaultBranch, context, deliver, log }) {
  await runFestivalData({ mode: 'update', stampsCount: true, root, defaultBranch, context, deliver, log });
}
