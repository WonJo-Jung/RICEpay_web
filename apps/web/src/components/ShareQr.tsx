import { QRCodeCanvas } from "qrcode.react";

export default function ShareQr({ url }: { url: string }) {
  return (
    <div className="mt-3">
      <div className="text-xs text-gray-500 mb-1">공유용 QR 코드</div>
      <div className="inline-block rounded border p-3">
        <QRCodeCanvas value={url} size={160} />
      </div>
    </div>
  );
}
