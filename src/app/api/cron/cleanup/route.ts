import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { col } from "@/lib/firestore/paths";
import { ROOM_INACTIVE_MS } from "@/lib/game/constants";
import { deleteRoomFully } from "@/lib/server/room-lifecycle";

/**
 * Call from a scheduler (e.g. Vercel Cron) with header:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const db = getAdminDb();
  const now = Timestamp.fromMillis(Date.now());
  let deleted = 0;

  const scheduled = await db.collection(col.rooms).where("cleanupAt", "<=", now).limit(25).get();
  for (const doc of scheduled.docs) {
    await deleteRoomFully(doc.id, doc.data());
    deleted++;
  }

  const cutoff = Timestamp.fromMillis(Date.now() - ROOM_INACTIVE_MS);
  const staleSnap = await db
    .collection(col.rooms)
    .where("lastActivityAt", "<", cutoff)
    .limit(25)
    .get();

  for (const doc of staleSnap.docs) {
    const ca = doc.data().cleanupAt as Timestamp | undefined;
    if (ca?.toMillis?.() && ca.toMillis() > Date.now()) continue;
    await deleteRoomFully(doc.id, doc.data());
    deleted++;
  }

  return Response.json({ ok: true, deletedRooms: deleted });
}
