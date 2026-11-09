# Tân Trường Tín — bản mã công khai cho giám khảo

Website trình bày: https://tantruongtin.com/

Đây là ảnh chụp mã nguồn hiện tại để giám khảo tham khảo. Kho phát triển gốc vẫn riêng tư vì lịch sử của kho đó có dữ liệu giá nhập. Bản công khai không chứa lịch sử, tệp môi trường, dữ liệu khách hàng, hoặc bảng giá nhập.

## Chạy thử tại máy

Cài Node.js, chạy `npm ci` rồi `npm run dev`. Các tính năng cần Supabase và SePay chỉ hoạt động khi được cấu hình biến môi trường phù hợp; không có khóa truy cập trong kho này.

## Công nghệ

Next.js 16, React 19, Supabase và Vercel. Các tệp SQL trong `supabase/migrations` mô tả cấu trúc và nghiệp vụ; tệp nạp dữ liệu mẫu có giá nhập đã được loại khỏi bản công khai.
