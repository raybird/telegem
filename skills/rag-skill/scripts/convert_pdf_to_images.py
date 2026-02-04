import os
import sys

from pdf2image import convert_from_path


# 將 PDF 的每一頁轉換為 PNG 圖片。


def convert(pdf_path, output_dir, max_dim=1000):
    images = convert_from_path(pdf_path, dpi=200)

    for i, image in enumerate(images):
        # 如果需要，縮放圖片以保持寬度/高度在 `max_dim` 以下
        width, height = image.size
        if width > max_dim or height > max_dim:
            scale_factor = min(max_dim / width, max_dim / height)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            image = image.resize((new_width, new_height))
        
        image_path = os.path.join(output_dir, f"page_{i+1}.png")
        image.save(image_path)
        print(f"已儲存第 {i+1} 頁為 {image_path} (尺寸: {image.size})")

    print(f"已轉換 {len(images)} 頁為 PNG 圖片")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法: convert_pdf_to_images.py [輸入 pdf] [輸出目錄]")
        sys.exit(1)
    pdf_path = sys.argv[1]
    output_directory = sys.argv[2]
    convert(pdf_path, output_directory)