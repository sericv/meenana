/**
 * Room fills the root flex shell (`flex-1 min-h-0`) so one flex chain owns
 * height — no `h-[visualViewport]` on this host (avoids iOS keyboard gaps vs
 * `html` / layout viewport).
 */
export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="room-viewport-host flex min-h-0 w-full max-w-[100vw] flex-1 flex-col overflow-hidden overscroll-none">
      {children}
    </div>
  );
}
