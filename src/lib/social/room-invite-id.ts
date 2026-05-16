/** Deterministic Firestore doc id for `users/{toUid}/roomInvites/{id}` (must match server). */
export function roomInviteDocId(fromUid: string, roomId: string): string {
  return `${fromUid}__${roomId}`;
}
