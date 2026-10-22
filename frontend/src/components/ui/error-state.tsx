export function ErrorState({ message, onRetry, actionLabel = "Thử lại" }: { message: string; onRetry?: () => void; actionLabel?: string }) {
  return <div role="alert" className="rounded-2xl border border-[#e8c5b5] bg-[#fff8f3] p-6 text-center">
    <p className="font-semibold text-[#713d2a]">Chưa thể tải nội dung</p>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#765e54]">{message}</p>
    {onRetry && <button onClick={onRetry} className="mt-4 rounded-full border border-[#b97757] px-5 py-2 text-sm font-semibold text-[#713d2a] hover:bg-[#f9ebe3]">{actionLabel}</button>}
  </div>;
}
