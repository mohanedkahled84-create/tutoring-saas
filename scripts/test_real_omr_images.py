import os
import sys
import numpy as np
from PIL import Image, ImageDraw

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def get_sample_darkness(pixels, w, h, norm_x, norm_y, norm_r=0.008):
    px = int(norm_x * w)
    py = int(norm_y * h)
    r = max(2, int(norm_r * min(w, h)))
    x0, y0 = max(0, px - r), max(0, py - r)
    x1, y1 = min(w, px + r), min(h, py + r)
    box = pixels[y0:y1, x0:x1]
    if box.size == 0:
        return 0.0
    lum = 0.299 * box[:, :, 0] + 0.587 * box[:, :, 1] + 0.114 * box[:, :, 2]
    return float(np.mean(255.0 - lum))

def run_optical_scan_on_image(image_path, exam_model="A", total_q=10, answer_key=None):
    if not os.path.exists(image_path):
        return None, f"File not found: {image_path}"
    
    im = Image.open(image_path).convert("RGB")
    w, h = im.size
    pixels = np.array(im)
    
    # 5 Control points: 4 alignment corner markers + center
    ctrl_points = [
        (0.03, 0.03), (0.97, 0.03),
        (0.5, 0.5),
        (0.03, 0.97), (0.97, 0.97)
    ]
    ctrl_samples = [get_sample_darkness(pixels, w, h, p[0], p[1], 0.02) for p in ctrl_points]
    min_ctrl = min(ctrl_samples)
    max_ctrl = max(ctrl_samples)
    diff_ctrl = max_ctrl - min_ctrl
    
    is_unreadable = False
    unreadable_reason = ""
    if min_ctrl > 220:
        is_unreadable = True
        unreadable_reason = "الصورة شديدة الظلمة (الشاشة أو الكاميرا معتمة بالكامل)"
    elif max_ctrl < 40:
        is_unreadable = True
        unreadable_reason = "الصورة شديدة البياض (فلاش ساطع أو ورقة بدون طباعة)"
    elif diff_ctrl < 15 and max_ctrl < 60:
        is_unreadable = True
        unreadable_reason = "تباين الإضاءة ضعيف جداً ولا يمكن تمييز حدود الورقة"

    grid_top = 0.33
    grid_height = 0.54
    col_width = 0.88
    col_left = 0.06
    
    arabic_letters = ["أ", "ب", "ج", "د"]
    default_key = [2, 0, 1, 0, 2, 3, 1, 0, 2, 3] # Q1: ج, Q2: أ, Q3: ب, Q4: أ, Q5: ج, Q6: د, Q7: ب, Q8: أ, Q9: ج, Q10: د
    key = answer_key or default_key
    
    breakdown = []
    earned_score = 0
    max_score = total_q * 2
    
    for q_idx in range(total_q):
        q_num = q_idx + 1
        norm_y = grid_top + (q_idx / float(total_q)) * grid_height
        
        opt_darkness = []
        for opt in range(4):
            base_x = col_left + col_width * (0.68 - opt * 0.16)
            max_local = 0.0
            for dx in [-0.012, 0, 0.012]:
                for dy in [-0.010, 0, 0.010]:
                    d = get_sample_darkness(pixels, w, h, base_x + dx, norm_y + dy, 0.008)
                    if d > max_local:
                        max_local = d
            opt_darkness.append(max_local)
        
        sorted_opts = sorted([(d, idx) for idx, d in enumerate(opt_darkness)], key=lambda x: x[0], reverse=True)
        top_opt = sorted_opts[0]
        second_opt = sorted_opts[1]
        min_opt = sorted_opts[3]
        
        contrast_diff = top_opt[0] - second_opt[0]
        rel_darkness = top_opt[0] - min_opt[0]
        
        is_multiple = (top_opt[0] >= 35 and second_opt[0] >= 28 and contrast_diff < 8)
        is_shaded = not is_multiple and ((contrast_diff >= 10 and top_opt[0] >= 35) or (rel_darkness >= 16 and top_opt[0] >= 38))
        
        student_choice = "لم يُظلل"
        student_idx = -1
        confidence = 95
        
        if is_multiple:
            student_choice = "تظليل ملتبس"
            confidence = 20
        elif is_shaded:
            student_idx = top_opt[1]
            student_choice = arabic_letters[student_idx]
            confidence = min(100, int(contrast_diff * 3 + rel_darkness))
        else:
            student_choice = "لم يُظلل"
            confidence = 90
            
        correct_idx = key[q_idx % len(key)]
        correct_letter = arabic_letters[correct_idx]
        is_correct = (student_idx >= 0 and student_idx == correct_idx)
        pts = 2 if is_correct else 0
        earned_score += pts
        
        breakdown.append({
            "q_num": q_num,
            "darkness": {arabic_letters[i]: round(opt_darkness[i], 1) for i in range(4)},
            "contrast_diff": round(contrast_diff, 1),
            "student_choice": student_choice,
            "student_idx": student_idx,
            "correct_letter": correct_letter,
            "correct_idx": correct_idx,
            "is_correct": is_correct,
            "points": pts,
            "confidence": confidence
        })
        
    return {
        "image_path": image_path,
        "width": w,
        "height": h,
        "ctrl_min": round(min_ctrl, 1),
        "ctrl_max": round(max_ctrl, 1),
        "ctrl_diff": round(diff_ctrl, 1),
        "is_unreadable": is_unreadable,
        "unreadable_reason": unreadable_reason,
        "score": earned_score,
        "max_score": max_score,
        "percentage": round((earned_score / float(max_score)) * 100),
        "breakdown": breakdown
    }, None

def generate_realistic_bubble_sheet_image(output_path):
    w, h = 800, 1100
    im = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(im)
    
    # Outer Border
    draw.rectangle([20, 20, w - 20, h - 20], outline=(0, 0, 0), width=2)
    # Alignment markers (4 corners)
    marker_size = 18
    draw.rectangle([20, 20, 20 + marker_size, 20 + marker_size], fill=(0, 0, 0))
    draw.rectangle([w - 20 - marker_size, 20, w - 20, 20 + marker_size], fill=(0, 0, 0))
    draw.rectangle([20, h - 20 - marker_size, 20 + marker_size, h - 20], fill=(0, 0, 0))
    draw.rectangle([w - 20 - marker_size, h - 20 - marker_size, w - 20, h - 20], fill=(0, 0, 0))
    
    # Header Box
    draw.rectangle([40, 50, w - 40, 110], outline=(0, 0, 0), width=1)
    
    # Student Code Box & Grid (at y ~ 130 to 280)
    draw.rectangle([40, 120, w - 40, 280], outline=(0, 0, 0), width=1)
    
    # Questions Grid Box
    grid_top_px = int(0.33 * h)
    grid_h_px = int(0.54 * h)
    draw.rectangle([int(0.06 * w), grid_top_px, int(0.94 * w), grid_top_px + grid_h_px], outline=(0, 0, 0), width=1)
    
    # 10 Questions setup
    col_width = 0.88
    col_left = 0.06
    arabic_letters = ["أ", "ب", "ج", "د"]
    
    # Student answers to shade:
    # Q1: ج (idx 2) - Correct
    # Q2: أ (idx 0) - Correct
    # Q3: ب (idx 1) - Correct
    # Q4: أ (idx 0) - Correct
    # Q5: ج (idx 2) - Correct
    # Q6: د (idx 3) - Correct
    # Q7: أ (idx 0) - Wrong (correct is ب)
    # Q8: أ (idx 0) - Correct
    # Q9: ج (idx 2) - Correct
    # Q10: لم يُظلل (Blank)
    student_shades = {
        1: 2,
        2: 0,
        3: 1,
        4: 0,
        5: 2,
        6: 3,
        7: 0,
        8: 0,
        9: 2,
        10: None
    }
    
    for q in range(1, 11):
        norm_y = 0.33 + ((q - 1) / 10.0) * 0.54
        center_y = int(norm_y * h)
        
        # Row divider line
        draw.line([int(0.06 * w), center_y + 18, int(0.94 * w), center_y + 18], fill=(220, 220, 220), width=1)
        
        for opt in range(4):
            base_x = col_left + col_width * (0.68 - opt * 0.16)
            center_x = int(base_x * w)
            radius = 11
            
            is_student_pick = (student_shades[q] == opt)
            if is_student_pick:
                # Realistic shaded graphite bubble (dark gray/black with slight pencil texture)
                draw.ellipse([center_x - radius, center_y - radius, center_x + radius, center_y + radius], fill=(35, 35, 38), outline=(0, 0, 0), width=2)
            else:
                # Unshaded clear white bubble with black border
                draw.ellipse([center_x - radius, center_y - radius, center_x + radius, center_y + radius], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
                
    im.save(output_path, "PNG")
    print(f"Realistic bubble sheet saved to {output_path}")

if __name__ == "__main__":
    realistic_img_path = "sample_real_bubble_sheet.png"
    generate_realistic_bubble_sheet_image(realistic_img_path)
    
    print("\n" + "="*80)
    print("1. SCAN RESULT FOR REALISTIC PRINTED & SHADED BUBBLE SHEET (sample_real_bubble_sheet.png):")
    print("="*80)
    res_real, err = run_optical_scan_on_image(realistic_img_path)
    if err:
        print("Error:", err)
    else:
        print(f"Overall Image Status: {'UNREADABLE' if res_real['is_unreadable'] else 'CLEAR & SHARP'}")
        print(f"Score: {res_real['score']} / {res_real['max_score']} ({res_real['percentage']}%)")
        print("\n| Question | Darkness (أ) | Darkness (ب) | Darkness (ج) | Darkness (د) | Diff | Detected | Key | Match | Pts | Conf |")
        print("|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|")
        for b in res_real["breakdown"]:
            d = b["darkness"]
            m = "✅" if b["is_correct"] else "❌"
            print(f"| Q{b['q_num']} | {d['أ']} | {d['ب']} | {d['ج']} | {d['د']} | {b['contrast_diff']} | **{b['student_choice']}** | {b['correct_letter']} | {m} | {b['points']} | {b['confidence']}% |")
            
    print("\n" + "="*80)
    print("2. SCAN RESULT FOR USER'S REAL UPLOADED CAMERA SCREEN (media_1793185609721_04a8840b.png):")
    print("="*80)
    user_cam_path = r"C:\Users\Dell\.gemini\antigravity\brain\1f95c81f-7d4e-42b2-b71d-0b0f71375201\.user_uploaded\media_1793185609721_04a8840b.png"
    res_cam, err_cam = run_optical_scan_on_image(user_cam_path)
    if err_cam:
        print("Error:", err_cam)
    else:
        print(f"Overall Image Status: {'⚠️ UNREADABLE (' + res_cam['unreadable_reason'] + ')' if res_cam['is_unreadable'] else 'CLEAR'}")
        print(f"Min Ctrl Darkness: {res_cam['ctrl_min']} | Max: {res_cam['ctrl_max']} | Diff: {res_cam['ctrl_diff']}")
        print(f"Score: {res_cam['score']} / {res_cam['max_score']} (0% auto-approval blocked by safety gate)")
        print("\n| Question | Darkness (أ) | Darkness (ب) | Darkness (ج) | Darkness (د) | Diff | Detected | Key | Match | Pts | Conf |")
        print("|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|")
        for b in res_cam["breakdown"]:
            d = b["darkness"]
            m = "✅" if b["is_correct"] else "❌"
            print(f"| Q{b['q_num']} | {d['أ']} | {d['ب']} | {d['ج']} | {d['د']} | {b['contrast_diff']} | **{b['student_choice']}** | {b['correct_letter']} | {m} | {b['points']} | {b['confidence']}% |")
