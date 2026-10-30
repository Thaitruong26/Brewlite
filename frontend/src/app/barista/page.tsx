"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { useStockStore } from "@/store/stock-store";

type OrderStage = "preparing" | "ready" | "completed";
type QueueTab = "preparing" | "ready" | "history";
type ProductLine = { quantity: number; name: string; size: string; options: string[] };
type IngredientItem = { sku: string; name: string; detail: string; unit: string; stock: number; minimum: number };
type BaristaOrder = {
  id: number;
  customer: string;
  placedAt: string;
  stage: OrderStage;
  elapsed: string;
  items: ProductLine[];
  note?: string;
};
type StockItem = { sku: string; name: string; description: string; category: string; price: number; stock: number; target: number };

const initialOrders: BaristaOrder[] = [
  { id: 1042, customer: "Nguyễn Thu Hà", placedAt: "08:24", stage: "preparing", elapsed: "05:14", items: [{ quantity: 1, name: "Trà đào cam sả", size: "L", options: ["50% đường", "Ít đá", "+ Thêm đào ngâm"] }, { quantity: 1, name: "Cà phê sữa đá", size: "M", options: ["Phin truyền thống", "70% ngọt", "Nhiều đá"] }], note: "Khách xin thêm túi quai đôi đựng ly." },
  { id: 1044, customer: "Trần Minh Quân", placedAt: "08:29", stage: "preparing", elapsed: "03:40", items: [{ quantity: 2, name: "Oolong Tứ Quý cheese", size: "L", options: ["30% đường", "Không đá", "Kem cheese riêng"] }, { quantity: 1, name: "Americano đá", size: "M", options: ["Hạt Arabica Cầu Đất", "Không đường"] }] },
  { id: 1046, customer: "Khách vãng lai #09", placedAt: "08:31", stage: "preparing", elapsed: "02:15", items: [{ quantity: 1, name: "Bạc xỉu ba tầng", size: "M", options: ["Ít sữa đặc", "Sữa tươi nguyên kem"] }], note: "Lấy thêm 1 ống hút giấy loại lớn." },
  { id: 1038, customer: "Lê Hải Yến", placedAt: "08:12", stage: "ready", elapsed: "4 phút trước", items: [{ quantity: 1, name: "Cold Brew Cam vàng", size: "L", options: ["50% ngọt", "Đá riêng"] }, { quantity: 1, name: "Trà sen vàng macchiato", size: "M", options: ["Kem béo đặc biệt", "Ít đá"] }] },
  { id: 1040, customer: "Võ Hoàng Nam", placedAt: "08:18", stage: "ready", elapsed: "2 phút trước", items: [{ quantity: 1, name: "Espresso đúp đá", size: "S", options: ["Không đường"] }] },
  { id: 1035, customer: "Phạm Nhật Anh", placedAt: "08:02", stage: "completed", elapsed: "08:20", items: [{ quantity: 2, name: "Trà nhài đặc thơm", size: "L", options: ["Ít ngọt"] }] },
  { id: 1034, customer: "Lý Tuấn Kiệt", placedAt: "07:54", stage: "completed", elapsed: "08:10", items: [{ quantity: 1, name: "Cà phê đen đá phin", size: "M", options: ["Ít ngọt"] }] },
];

const initialStock: StockItem[] = [
  { sku: "CF-001", name: "Cà phê sữa đá Sài Gòn", description: "Cà phê Robusta Đắk Lắk & sữa đặc", category: "Cà phê", price: 29000, stock: 42, target: 50 },
  { sku: "CF-002", name: "Cà phê đen đá phin", description: "Hạt Culi Robusta nguyên chất mộc", category: "Cà phê", price: 25000, stock: 28, target: 40 },
  { sku: "CF-003", name: "Cà phê muối xứ Huế", description: "Kem muối béo ngậy mặn ngọt thanh", category: "Đặc sản", price: 35000, stock: 18, target: 30 },
  { sku: "CF-004", name: "Cold Brew Sữa Yến Mạch", description: "Ủ lạnh 18h & sữa yến mạch", category: "Cà phê", price: 42000, stock: 15, target: 25 },
  { sku: "TR-001", name: "Trà Đào Cam Sả Kim Tuyến", description: "Cốt trà Kim Tuyến & đào miếng giòn", category: "Trà trái cây", price: 39000, stock: 32, target: 45 },
  { sku: "TR-002", name: "Trà Lài Vải Thiều Băng Tuyết", description: "Trà hoa lài ướp hoa tươi & trái vải mọng", category: "Trà trái cây", price: 39000, stock: 24, target: 35 },
  { sku: "DX-001", name: "Matcha Latte Yuji Nghiền Cối", description: "Bột Yuji Nhật Bản & sữa tươi nguyên kem", category: "Đặc sản", price: 45000, stock: 8, target: 20 },
  { sku: "TP-001", name: "Trân châu đen đường đen", description: "Nấu mới theo mẻ 4 tiếng", category: "Topping", price: 10000, stock: 0, target: 20 },
];

const ingredients: IngredientItem[] = [
  { sku: "NL-001", name: "Hạt Robusta Đắk Lắk", detail: "Rang mộc · Lô rang 24/10", unit: "kg", stock: 8.5, minimum: 3 },
  { sku: "NL-002", name: "Hạt Arabica Cầu Đất", detail: "Rang vừa · Lô rang 23/10", unit: "kg", stock: 4.2, minimum: 2 },
  { sku: "NL-003", name: "Sữa tươi nguyên kem", detail: "Bảo quản lạnh · Hạn dùng 02/11", unit: "lít", stock: 12, minimum: 5 },
  { sku: "NL-004", name: "Sữa đặc", detail: "Thùng đang sử dụng", unit: "lon", stock: 18, minimum: 6 },
  { sku: "NL-005", name: "Trà Ô Long Tứ Quý", detail: "Bảo quản kín, tránh ánh sáng", unit: "kg", stock: 2.4, minimum: 1 },
  { sku: "NL-006", name: "Trà lài", detail: "Bảo quản kín, tránh ánh sáng", unit: "kg", stock: 1.2, minimum: 1.5 },
  { sku: "NL-007", name: "Đào ngâm", detail: "Đã mở nắp · Bảo quản lạnh", unit: "hũ", stock: 0, minimum: 2 },
  { sku: "NL-008", name: "Cam tươi", detail: "Kiểm tra chất lượng đầu ca", unit: "kg", stock: 3.5, minimum: 2 },
  { sku: "NL-009", name: "Bột Matcha", detail: "Bảo quản kín, tránh ánh sáng", unit: "gói", stock: 1, minimum: 1 },
];

const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)}đ`;

export default function BaristaPage() {
  const [section, setSection] = useState<"queue" | "stock" | "ingredients">("queue");
  const [queueTab, setQueueTab] = useState<QueueTab>("preparing");
  const [orders, setOrders] = useState(initialOrders);
  const [ingredientStock, setIngredientStock] = useState(ingredients);
  const [receivingSku, setReceivingSku] = useState<string | null>(null);
  const [receivingAmount, setReceivingAmount] = useState("1");
  const stock = initialStock;
  const availability = useStockStore((state) => state.availability);
  const hydrateAvailability = useStockStore((state) => state.hydrate);
  const setAvailability = useStockStore((state) => state.setAvailability);
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState("vừa xong");

  useEffect(() => {
    hydrateAvailability();
    const sync = () => hydrateAvailability();
    window.addEventListener("brewlite:stock-availability-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("brewlite:stock-availability-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [hydrateAvailability]);

  const counts = useMemo(() => ({
    preparing: orders.filter((order) => order.stage === "preparing").length,
    ready: orders.filter((order) => order.stage === "ready").length,
    history: orders.filter((order) => order.stage === "completed").length,
  }), [orders]);

  function moveOrder(id: number, stage: OrderStage) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, stage } : order));
    setNotice(stage === "ready" ? `Đơn #${id} đã chuyển sang mục Làm xong.` : `Đơn #${id} đã ghi nhận giao thành công.`);
  }

  function refresh() {
    setUpdatedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
    setNotice("Đã làm mới dữ liệu xem trước.");
  }

  function toggleAvailability(sku: string) {
    const item = stock.find((entry) => entry.sku === sku);
    if (!item) return;
    const available = !(availability[sku] ?? item.stock > 0);
    setAvailability(sku, available);
    setNotice(`${sku} đã chuyển sang ${available ? "Đang bán" : "Tạm hết"}; thực đơn trên giao diện cũng được cập nhật.`);
  }

  function receiveIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(receivingAmount);
    if (!receivingSku || !Number.isFinite(amount) || amount <= 0) return;
    const item = ingredientStock.find((entry) => entry.sku === receivingSku);
    if (!item) return;
    setIngredientStock((current) => current.map((entry) => entry.sku === receivingSku
      ? { ...entry, stock: Number((entry.stock + amount).toFixed(2)) }
      : entry));
    setNotice(`Đã nhập thêm ${amount} ${item.unit} ${item.name}. Tồn kho đã được cập nhật trong bản xem trước.`);
    setReceivingSku(null);
  }

  const visibleOrders = orders.filter((order) => order.stage === (queueTab === "history" ? "completed" : queueTab));

  return <div className="min-h-[calc(100svh-68px)] bg-[#f7f5ef] text-[#1e3429]">
    <header className="sticky top-[0px] z-20 border-b border-[#e3e4dc] bg-[#fbfaf6]">
      <div className="mx-auto flex min-h-[70px] max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <Image src="/img/brewlite-mark.svg" alt="" width={40} height={40} priority />
          <div className="leading-tight"><p className="text-lg font-bold tracking-tight">BrewLite</p><p className="text-[11px] text-[#6d756e]">Quầy pha chế · Barista</p></div>
        </div>
        <nav aria-label="Khu vực quầy" className="flex rounded-xl border border-[#e3e1d8] bg-[#f2f0e8] p-1">
          <button onClick={() => setSection("queue")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${section === "queue" ? "bg-white text-[#174c32] shadow-sm" : "text-[#5b675f]"}`}>Hàng đợi đơn</button>
          <button onClick={() => setSection("stock")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${section === "stock" ? "bg-white text-[#174c32] shadow-sm" : "text-[#5b675f]"}`}>Tồn kho</button>
          <button onClick={() => setSection("ingredients")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${section === "ingredients" ? "bg-white text-[#174c32] shadow-sm" : "text-[#5b675f]"}`}>Nguyên liệu</button>
        </nav>
        <div className="flex items-center gap-3">
          <button onClick={refresh} className="rounded-xl border border-[#dedfd7] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#f5f5ef]">↻ <span className="ml-1">Làm mới</span></button>
          <span className="hidden border-l border-[#dedfd7] pl-4 text-right text-sm sm:block"><b>Barista Demo</b><small className="block text-xs text-[#707870]">Bản xem trước · Mang đi</small></span>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#55715e]">Quầy pha chế · Mang đi</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#17432e]">{section === "queue" ? "Hàng đợi pha chế" : section === "stock" ? "Tồn kho sản phẩm" : "Nguyên liệu pha chế"}</h1></div>
        <div className="flex items-center gap-2 rounded-xl bg-[#f0efe9] px-4 py-3 text-sm"><span className="size-2 rounded-full bg-[#168451]"/><span><b>{orders.length} đơn</b><span className="text-[#788078]"> · Cập nhật {updatedAt}</span></span></div>
      </div>

      {notice && <p role="status" className="mb-4 rounded-lg border border-[#d4e7d8] bg-[#eef7ef] px-4 py-2.5 text-sm text-[#225c3a]">{notice}<button onClick={() => setNotice("")} className="float-right font-semibold" aria-label="Đóng thông báo">×</button></p>}
      <p className="mb-5 text-xs text-[#737970]">Bản xem trước giao diện · dữ liệu và thao tác hiện chỉ lưu trong phiên trình duyệt.</p>

      {section === "queue" ? <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6e5dd] bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Trạng thái đơn hàng">
            {(["preparing", "ready", "history"] as QueueTab[]).map((tab) => {
              const label = tab === "preparing" ? "Đang làm" : tab === "ready" ? "Làm xong" : "Lịch sử";
              return <button key={tab} role="tab" aria-selected={queueTab === tab} onClick={() => setQueueTab(tab)} className={`relative rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${queueTab === tab ? "bg-[#f4f5ef] text-[#174c32]" : "text-[#606b63] hover:bg-[#f8f8f4]"}`}>{label}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${queueTab === tab ? "bg-[#174c32] text-white" : "bg-[#ecece7] text-[#555f57]"}`}>{counts[tab]}</span>{queueTab === tab && <span className="absolute inset-x-4 -bottom-2 h-0.5 bg-[#174c32]"/>}</button>;
            })}
          </div>
          <span className="px-3 text-xs text-[#687269]">Chỉ hiển thị đơn mang đi</span>
        </div>

        {queueTab === "history" && <div className="mb-4 rounded-xl bg-[#eeefe9] px-4 py-3 text-sm text-[#465b4c]">Đơn đã giao thành công trong ca làm việc.</div>}
        {visibleOrders.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleOrders.map((order) => <article key={order.id} className="overflow-hidden rounded-2xl border border-[#e9e7df] bg-white shadow-[0_2px_8px_rgba(31,47,35,0.04)]">
            <div className="flex items-start justify-between gap-3 bg-[#f1f0e9] px-5 py-4">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold text-[#163f2b]">#{order.id}</h2><span className="rounded-md bg-[#e1e5dc] px-2 py-1 text-[11px] font-semibold text-[#445248]">Mang đi</span></div><p className="mt-1.5 text-sm font-medium">{order.customer}</p></div>
              <div className="text-right"><span className={`rounded-md px-2 py-1 text-xs font-bold ${order.stage === "preparing" && order.elapsed.startsWith("05") ? "bg-[#ffe0de] text-[#a5362d]" : "bg-[#d7f5df] text-[#16623a]"}`}>{order.stage === "ready" ? "Đang giao" : order.stage === "completed" ? "Đã giao" : order.elapsed}</span><p className="mt-2 text-xs text-[#737970]">Đặt lúc {order.placedAt}</p></div>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {order.items.map((item, index) => <div key={`${order.id}-${index}`} className="rounded-xl bg-[#f8f7f3] p-3">
                <div className="flex items-start justify-between gap-2"><p className="font-semibold"><span className="mr-2 inline-flex size-7 items-center justify-center rounded-md bg-[#b5edc1] text-sm font-bold text-[#154a2c]">{item.quantity}×</span>{item.name}</p><span className="shrink-0 pt-1 text-xs font-semibold text-[#35513e]">Size {item.size}</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5">{item.options.map((option) => <span key={option} className="rounded-md bg-[#eeede7] px-2 py-1 text-xs text-[#555c56]">{option}</span>)}</div>
              </div>)}
              {order.note && <div className="rounded-xl bg-[#edede8] px-3 py-2.5 text-sm text-[#4b554e]"><span className="font-semibold text-[#315840]">Ghi chú:</span> {order.note}</div>}
              {order.stage !== "completed" ? <button onClick={() => moveOrder(order.id, order.stage === "preparing" ? "ready" : "completed")} className="w-full rounded-xl bg-[#145332] px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-[#0f4328] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#145332]">{order.stage === "preparing" ? "✓  Đã làm xong" : "✓  Đã giao thành công"}</button> : <div className="border-t border-[#eeede7] pt-3 text-sm text-[#56705d]">✓ Đã giao thành công · {order.elapsed}</div>}
            </div>
          </article>)}
        </div> : <div className="rounded-2xl border border-dashed border-[#d9ddd5] bg-white px-6 py-16 text-center text-sm text-[#737970]">Chưa có đơn trong mục này.</div>}
      </> : section === "stock" ? <div className="overflow-hidden rounded-2xl border border-[#e6e5dd] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5"><div><h2 className="text-xl font-bold text-[#17432e]">Tồn kho theo món</h2><p className="mt-1 text-sm text-[#737970]">Đổi trạng thái món để cập nhật thực đơn.</p></div><span className="rounded-full bg-[#eef0e9] px-3 py-1.5 text-sm font-semibold">{stock.length} sản phẩm</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] border-collapse text-left"><thead className="bg-[#f4f4ef] text-[11px] uppercase tracking-wide text-[#626c64]"><tr>{["Mã món", "Tên món", "Phân loại", "Giá bán", "Tồn kho", "Trạng thái"].map((heading) => <th key={heading} className="px-4 py-3 font-bold first:pl-5 last:pr-5">{heading}</th>)}</tr></thead><tbody>
          {stock.map((item) => { const percentage = Math.round(item.stock / item.target * 100); const isAvailable = availability[item.sku] ?? item.stock > 0; return <tr key={item.sku} className="border-t border-[#eeede7] hover:bg-[#fcfcf9]"><td className="whitespace-nowrap px-4 py-4 pl-5 font-mono text-xs text-[#657067]">{item.sku}</td><td className="min-w-[250px] px-4 py-3"><p className="font-semibold text-[#263b2d]">{item.name}</p><p className="mt-0.5 text-xs text-[#7c827b]">{item.description}</p></td><td className="px-4 py-3"><span className="rounded-full bg-[#f0efe9] px-2.5 py-1 text-xs">{item.category}</span></td><td className="whitespace-nowrap px-4 py-3 font-semibold">{money(item.price)}</td><td className="min-w-[155px] px-4 py-3"><div className="flex justify-between text-xs"><span className="font-semibold">{item.stock}/{item.target}</span><span className="text-[#647066]">{percentage}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e6e6e0]"><div className={`h-full rounded-full ${item.stock === 0 ? "bg-[#bd3d34]" : item.stock <= 10 ? "bg-[#8a7950]" : "bg-[#1a6940]"}`} style={{ width: `${Math.min(percentage, 100)}%` }}/></div></td><td className="px-4 py-3 pr-5"><button type="button" onClick={() => toggleAvailability(item.sku)} aria-label={`Chuyển ${item.name} sang ${isAvailable ? "Tạm hết" : "Đang bán"}`} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition hover:brightness-95 ${isAvailable ? "bg-[#daf4e0] text-[#1e7141]" : "bg-[#fde4e1] text-[#a5332a]"}`}>{isAvailable ? "● Đang bán" : "● Tạm hết"}</button></td></tr>; })}
        </tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ecebe5] bg-[#f8f7f2] px-5 py-3 text-xs text-[#59645b]"><span>● Đang bán &nbsp; · &nbsp; ● Tạm hết · Trạng thái thực đơn được đồng bộ trong giao diện.</span><span>Tổng số món: {stock.length}</span></div>
      </div> : <div className="overflow-hidden rounded-2xl border border-[#e6e5dd] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5"><div><h2 className="text-xl font-bold text-[#17432e]">Tồn nguyên liệu trong ca</h2><p className="mt-1 text-sm text-[#737970]">Theo dõi lượng còn lại và nhập thêm khi cần.</p></div><span className="rounded-full bg-[#eef0e9] px-3 py-1.5 text-sm font-semibold">{ingredientStock.length} nguyên liệu</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] border-collapse text-left"><thead className="bg-[#f4f4ef] text-[11px] uppercase tracking-wide text-[#626c64]"><tr>{["Mã", "Tên nguyên liệu", "Đơn vị", "Tồn hiện tại", "Mức tối thiểu", "Tình trạng", "Thao tác"].map((heading) => <th key={heading} className="px-4 py-3 font-bold first:pl-5 last:pr-5">{heading}</th>)}</tr></thead><tbody>
          {ingredientStock.map((item) => { const status = item.stock === 0 ? "Tạm hết" : item.stock <= item.minimum ? "Sắp hết" : "Còn hàng"; const percent = Math.min(Math.round(item.stock / Math.max(item.minimum * 2, 1) * 100), 100); return <tr key={item.sku} className="border-t border-[#eeede7] hover:bg-[#fcfcf9]"><td className="whitespace-nowrap px-4 py-4 pl-5 font-mono text-xs text-[#657067]">{item.sku}</td><td className="min-w-[250px] px-4 py-3"><p className="font-semibold text-[#263b2d]">{item.name}</p><p className="mt-0.5 text-xs text-[#7c827b]">{item.detail}</p></td><td className="px-4 py-3 text-sm text-[#5c665e]">{item.unit}</td><td className="min-w-[150px] px-4 py-3"><div className="flex justify-between text-sm"><span className="font-semibold">{item.stock}</span><span className="text-xs text-[#737970]">{item.unit}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e6e6e0]"><div className={`h-full rounded-full ${status === "Tạm hết" ? "bg-[#bd3d34]" : status === "Sắp hết" ? "bg-[#bc8a2f]" : "bg-[#1a6940]"}`} style={{ width: `${percent}%` }}/></div></td><td className="px-4 py-3 text-sm text-[#5c665e]">{item.minimum} {item.unit}</td><td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${status === "Tạm hết" ? "bg-[#fde4e1] text-[#a5332a]" : status === "Sắp hết" ? "bg-[#fff1d5] text-[#805817]" : "bg-[#daf4e0] text-[#1e7141]"}`}>{status}</span></td><td className="whitespace-nowrap px-4 py-3 pr-5 text-right"><button type="button" onClick={() => { setReceivingSku(item.sku); setReceivingAmount("1"); }} className="rounded-lg bg-[#174c32] px-3 py-2 text-xs font-semibold text-white hover:bg-[#103d27]">+ Nhập hàng</button></td></tr>; })}
        </tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ecebe5] bg-[#f8f7f2] px-5 py-3 text-xs text-[#59645b]"><span>● Còn hàng &nbsp; · &nbsp; ● Sắp hết khi tồn bằng hoặc thấp hơn mức tối thiểu &nbsp; · &nbsp; ● Tạm hết khi số lượng bằng 0</span><span>Đang theo dõi {ingredients.length} nguyên liệu</span></div>
      </div>}
    </main>

    <footer className="mt-12 border-t border-[#e3e1d8] bg-[#f4f2ec] px-5 py-4 text-sm text-[#657067]"><div className="mx-auto flex max-w-[1500px] justify-between"><span>BrewLite Barista · Quầy mang đi</span><span className="font-medium text-[#28613d]">● Đang hoạt động</span></div></footer>

    {receivingSku && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10251b]/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReceivingSku(null); }}><form onSubmit={receiveIngredient} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold text-[#17432e]">Nhập hàng nguyên liệu</h2><p className="mt-1 text-sm text-[#737970]">{ingredientStock.find((item) => item.sku === receivingSku)?.name}</p><label className="mt-5 block text-sm font-semibold" htmlFor="ingredient-receive-amount">Số lượng nhập ({ingredientStock.find((item) => item.sku === receivingSku)?.unit})</label><input autoFocus id="ingredient-receive-amount" type="number" min={receivingSku && ["kg", "lít"].includes(ingredientStock.find((item) => item.sku === receivingSku)?.unit ?? "") ? "0.1" : "1"} step={receivingSku && ["kg", "lít"].includes(ingredientStock.find((item) => item.sku === receivingSku)?.unit ?? "") ? "0.1" : "1"} value={receivingAmount} onChange={(event) => setReceivingAmount(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d9ddd5] px-3 py-2.5 outline-none focus:border-[#267143] focus:ring-2 focus:ring-[#267143]/15"/><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReceivingSku(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#59645b] hover:bg-[#f3f3ee]">Hủy</button><button type="submit" className="rounded-lg bg-[#145332] px-4 py-2 text-sm font-bold text-white hover:bg-[#0f4328]">Xác nhận nhập</button></div></form></div>}

  </div>;
}
