import pygame
import random
import math

# --- 1. KHỞI TẠO HỆ THỐNG ---
pygame.init()
pygame.mixer.init()

WIDTH, HEIGHT = 800, 700
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Đua Xe Toán Học (Hiệu - Tỉ) - Chinh Phục 10 Thử Thách")
clock = pygame.time.Clock()

# Màu sắc thiết kế
ROAD_COLOR = (45, 45, 45)
DASHBOARD_BG = (15, 15, 25)
CYAN = (255, 204, 0)   # Gold
GOLD = (255, 204, 0)
ORANGE = (255, 102, 0)
RED = (255, 69, 0)    # Sunset Red/Orange
BLUE = (255, 140, 0)  # Dark Orange for progress
WHITE = (255, 250, 230) # Off white

# DỮ LIỆU BÀI TOÁN
QUESTIONS = [
    {"q": "Hiệu của hai số là 24. Tỉ số của hai số đó là 3/5.", "a": "36;60"},
    {"q": "HCN có chiều dài hơn chiều rộng 15m. Rộng bằng 2/3 dài.", "a": "30;45"},
    {"q": "Mẹ hơn con 28 tuổi. Tuổi con bằng 2/9 tuổi mẹ.", "a": "8;36"},
    {"q": "Gạo tẻ nhiều hơn gạo nếp 120kg. Nếp bằng 3/7 tẻ.", "a": "90;210"},
    {"q": "Số thứ hai lớn hơn số thứ nhất là 30. Tỉ số là 3/2.", "a": "60;90"},
    {"q": "Hiệu của hai số là 8.5. Số bé bằng 3/4 số lớn.", "a": "25.5;34"},
    {"q": "Gà nhiều hơn vịt 45 con. Số vịt bằng 2/5 gà.", "a": "30;75"},
    {"q": "Tìm hai số biết hiệu của chúng là 100 và tỉ số là 5/9.", "a": "125;225"},
    {"q": "Nhà An xa trường hơn nhà Bình 1.5km. Bình = 2/3 An.", "a": "3;4.5"},
    {"q": "Hiệu là 18. Lấy 1/3 Thùng 1 bằng 1/5 Thùng 2.", "a": "27;45"}
]

class Particle:
    def __init__(self, x, y):
        self.x, self.y = x, y
        self.color = (random.randint(100, 255), random.randint(100, 255), random.randint(100, 255))
        self.vx = random.uniform(-4, 4)
        self.vy = random.uniform(-4, 4)
        self.life = 100

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.life -= 2

class Hurdle:
    def __init__(self, idx):
        self.width = 60
        self.height = 40
        self.x = random.randint(220, 580 - self.width)
        self.y = -100
        self.idx = idx
        self.color = YELLOW

    def update(self, speed):
        self.y += speed

    def draw(self, surface):
        pygame.draw.rect(surface, self.color, (self.x, self.y, self.width, self.height), border_radius=5)
        font = pygame.font.SysFont("Verdana", 20, bold=True)
        lbl = font.render(str(self.idx + 1), True, (0, 0, 0))
        surface.blit(lbl, (self.x + 20, self.y + 5))

class Car:
    def __init__(self):
        self.width = 100
        self.height = 126
        self.x = 350
        self.y = 150
        self.speed = 5

    def move(self, dx):
        self.x += dx
        if self.x < 205: self.x = 205
        if self.x > 595 - self.width: self.x = 595 - self.width

    def draw(self, surface):
        # Body
        pygame.draw.rect(surface, RED, (self.x, self.y, self.width, self.height), border_radius=8)
        # Windows
        pygame.draw.rect(surface, CYAN, (self.x+5, self.y+10, 40, 20), border_radius=2)
        # Tires
        pygame.draw.rect(surface, (0,0,0), (self.x-5, self.y+15, 5, 25))
        pygame.draw.rect(surface, (0,0,0), (self.x+50, self.y+15, 5, 25))
        pygame.draw.rect(surface, (0,0,0), (self.x-5, self.y+55, 5, 25))
        pygame.draw.rect(surface, (0,0,0), (self.x+50, self.y+55, 5, 25))

    def get_rect(self):
        return pygame.Rect(self.x, self.y, self.width, self.height)

class Game:
    def __init__(self):
        self.state = "START" # START, DRIVING, QUIZ, FINISH
        self.car = Car()
        self.hurdle = None
        self.current_idx = 0
        self.user_input = ""
        self.road_offset = 0
        self.fireworks = []
        self.speed = 8
        self.font_main = pygame.font.SysFont("Verdana", 24)
        self.font_bold = pygame.font.SysFont("Verdana", 28, bold=True)
        self.font_small = pygame.font.SysFont("Verdana", 18)
        
        try:
            self.snd_engine = pygame.mixer.Sound("assets/sounds/engine.mp3")
            self.snd_cheer = None
        except:
            self.snd_engine = None
        
        self.engine_on = False

    def reset_hurdle(self):
        self.hurdle = Hurdle(self.current_idx)

    def update(self):
        if self.state == "DRIVING":
            if self.snd_engine and not self.engine_on:
                self.snd_engine.play(-1)
                self.engine_on = True
            
            self.road_offset = (self.road_offset + self.speed) % 60
            
            if not self.hurdle:
                if random.random() < 0.0025:
                    self.reset_hurdle()
            else:
                self.hurdle.update(self.speed)
                if self.hurdle.y > 350:
                    self.hurdle = None
                elif self.car.get_rect().colliderect(pygame.Rect(self.hurdle.x, self.hurdle.y, self.hurdle.width, self.hurdle.height)):
                    self.state = "QUIZ"
                    if self.snd_engine:
                        self.snd_engine.stop()
                        self.engine_on = False

            keys = pygame.key.get_pressed()
            if keys[pygame.K_LEFT]: self.car.move(-7)
            if keys[pygame.K_RIGHT]: self.car.move(7)

        elif self.state == "FINISH":
            if random.random() < 0.2:
                for _ in range(10): 
                    self.fireworks.append(Particle(random.randint(0, WIDTH), random.randint(0, 350)))
            for p in self.fireworks[:]:
                p.update()
                if p.life <= 0: self.fireworks.remove(p)

    def draw(self):
        screen.fill(GRASS)
        
        # Vẽ Đường đua
        pygame.draw.rect(screen, ROAD_COLOR, (200, 0, 400, 350))
        # Vạch kẻ đường
        for i in range(-60, 400, 60):
            pygame.draw.rect(screen, WHITE, (395, i + self.road_offset, 10, 30))
        
        # Vẽ xe
        self.car.draw(screen)
        
        # Vẽ chướng ngại vật
        if self.hurdle:
            self.hurdle.draw(screen)

        # Vẽ Pháo hoa
        for p in self.fireworks:
            pygame.draw.circle(screen, p.color, (int(p.x), int(p.y)), 3)

        # Vẽ Bảng điều khiển
        pygame.draw.rect(screen, DASHBOARD_BG, (0, 350, WIDTH, 350))
        pygame.draw.line(screen, CYAN, (0, 350), (WIDTH, 350), 4)

        if self.state == "START":
            self.draw_text_centered("ĐUA XE TOÁN HỌC", self.font_bold, GOLD, 400)
            self.draw_text_centered("Nhấn SPACE để bắt đầu đua!", self.font_main, WHITE, 480)
            self.draw_text_centered("Dùng phím Mũi tên để lái xe tránh hoặc chạm vật cản", self.font_small, CYAN, 550)
            
        elif self.state == "DRIVING":
            lbl_drive = self.font_main.render("ĐANG TRÊN ĐƯỜNG ĐUA... LÁI XE CẨN THẬN!", True, WHITE)
            screen.blit(lbl_drive, (150, 400))
            
            # Progress bar
            pygame.draw.rect(screen, (50, 50, 50), (150, 500, 500, 20), border_radius=10)
            progress = (self.current_idx / len(QUESTIONS)) * 500
            pygame.draw.rect(screen, BLUE, (150, 500, progress, 20), border_radius=10)
            lbl_progress = self.font_small.render(f"Tiến độ: {self.current_idx}/10 câu", True, WHITE)
            screen.blit(lbl_progress, (150, 530))

        elif self.state == "QUIZ":
            lbl_title = self.font_bold.render(f"CHƯỚNG NGẠI VẬT {self.current_idx + 1}/10", True, GOLD)
            lbl_ques = self.font_main.render(QUESTIONS[self.current_idx]["q"], True, WHITE)
            lbl_input = self.font_bold.render(f"Đáp án (Số bé;Số lớn): {self.user_input}_", True, CYAN)
            screen.blit(lbl_title, (50, 380))
            screen.blit(lbl_ques, (50, 440))
            screen.blit(lbl_input, (50, 520))
            lbl_help = self.font_small.render("Dùng dấu chấm cho số thập phân. Vd: 12.5;25", True, (180, 180, 180))
            screen.blit(lbl_help, (50, 580))

        elif self.state == "FINISH":
            lbl_win = self.font_bold.render("CHIẾN THẮNG RỰC RỠ! 🏆", True, GOLD)
            screen.blit(lbl_win, (WIDTH//2 - 180, 450))
            lbl_retry = self.font_main.render("Nhấn R để chơi lại", True, WHITE)
            screen.blit(lbl_retry, (WIDTH//2 - 100, 520))

    def draw_text_centered(self, text, font, color, y):
        lbl = font.render(text, True, color)
        rect = lbl.get_rect(center=(WIDTH//2, y))
        screen.blit(lbl, rect)

    def handle_event(self, event):
        if event.type == pygame.KEYDOWN:
            if self.state == "START":
                if event.key == pygame.K_SPACE:
                    self.state = "DRIVING"
            
            elif self.state == "QUIZ":
                if event.key == pygame.K_RETURN:
                    processed_input = self.user_input.replace(",", ".").replace(" ", "")
                    # Tự động thêm .0 nếu thiếu để khớp với data nếu cần, 
                    # hoặc so sánh số học. Ở đây giữ nguyên chuỗi đáp án chuẩn.
                    if processed_input == QUESTIONS[self.current_idx]["a"]:
                        self.current_idx += 1
                        self.user_input = ""
                        self.hurdle = None
                        if self.current_idx >= len(QUESTIONS):
                            self.state = "FINISH"
                            if self.snd_cheer: self.snd_cheer.play()
                        else:
                            self.state = "DRIVING"
                    else:
                        self.user_input = "" # Sai thì xóa
                elif event.key == pygame.K_BACKSPACE:
                    self.user_input = self.user_input[:-1]
                else:
                    if event.unicode in "0123456789.,; ":
                        self.user_input += event.unicode
            
            elif self.state == "FINISH":
                if event.key == pygame.K_r:
                    self.__init__()
                    self.state = "DRIVING"

def main():
    game = Game()
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            game.handle_event(event)

        game.update()
        game.draw()
        
        pygame.display.flip()
        clock.tick(60)

    pygame.quit()

if __name__ == "__main__":
    main()

