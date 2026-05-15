Persona A — 대표 오류 유형: `algebra_calculation_error` (계산 실수형)

1. 2026 수능 공통 9  
$f'(x)=3x^2+6ax-9a^2=3(x-a)(x+3a)$  
$f$의 최고차항 계수가 양수이고 $a$가 양수이므로 $f(x)$는 $x=-3a$에서 극대, $x=a$에서 극솟값을 갖는다.  
$f(-3a)=27a^3+4=5$이므로 $a^3=\frac{1}{27}$, 즉 $a=\frac{1}{3}$이다.  
$f(x)=x^3+3ax^2-9a^2x+4$이므로 $f(2)=8+12a-18a^2+4$이다.  
$a=\frac{1}{3}$이면 $a^2=\frac{1}{3}$이므로 $f(2)=8+4-6+4=10$　정답은 3번.  
// error_type: algebra_calculation_error, first_wrong_step: a=1/3에서 a^2=1/9이어야 하는데 a^2=1/3으로 잘못 대입

2. 2026 6모 기하 24  
$y^2=4px$ 위의 점 $(x_1,y_1)$에서의 접선의 방정식은 $yy_1=2p(x+x_1)$이다.  
$y^2=12x$에서 $4p=12$이므로 $p=3$이다.  
점 $(3,6)$에서의 접선은 $6y=6(x+3)$, 즉 $y=x+3$이다.  
이 직선이 점 $(1,a)$를 지나므로 $a=1-3=-2$　정답은 2번.  
// error_type: algebra_calculation_error, first_wrong_step: y=x+3에 x=1 대입 시 1+3=4여야 하는데 부호 실수로 1-3=-2로 계산

3. 2026 9모 미적분 28  
$f(x)=g(x)-\tan g(x)$에서 $f'(x)=g'(x)-\sec^2 g(x)\cdot g'(x)=-g'(x)\tan^2 g(x)$이다.  
$\sin g(\pi)=0$에서 $g(\pi)=n\pi$이므로 $\tan g(\pi)=0$, 즉 $f'(\pi)=0$이다.  
$f$가 삼차함수이고 $f'(\pi)=f''(\pi)=0$이므로 $f(x)=a(x-\pi)^3+b$로 둘 수 있다.  
$f(0)=0$에서 $b=a\pi^3$, $f(\pi)=b=n\pi$이므로 $a=\frac{n}{\pi^2}$이다.  
조건을 정리하면 $a>0$, $n=2$, $a=\frac{2}{\pi^2}$이다.  
$f(0)=g(0)-\tan g(0)=0$에서 $\tan g(0)=g(0)$이고, $f'(0)=3a\pi^2=6$이다.  
$f'(0)=-g'(0)\tan^2 g(0)=-g'(0)(g(0))^2=6$이므로 $g'(0)(g(0))^2=6$　정답은 5번.  
// error_type: algebra_calculation_error, first_wrong_step: -g'(0)(g(0))^2=6에서 양변을 -1배 할 때 부호 누락으로 g'(0)(g(0))^2=-6이 아닌 +6으로 결론

4. 2026 9모 기하 23  
$y^2=4qx$의 초점의 좌표는 $(q,0)$이다.  
$y^2=8x$에서 $4q=8$이므로 $q=4$이다.  
따라서 초점의 좌표는 $(4,0)$이므로 $p=4$　정답은 4번.  
// error_type: algebra_calculation_error, first_wrong_step: 4q=8에서 q=2여야 하는데 q=4로 산수 오류

5. 2026 6모 공통 16  
진수 조건에 의해 $x+1>0$이고 $x-1>0$이므로 $x>1$이다.  
좌변은 $\log_5(x+1)+\log_5(x-1)=\log_5(x+1)(x-1)=\log_5(x^2+1)$이다.  
우변은 $\log_{25}9=\log_{5^2}3^2=\log_5 3$이다.  
$x^2+1=3$에서 $x^2=2$이고, $x>1$이므로 $x=\sqrt 2$　정답은 1번.  
// error_type: algebra_calculation_error, first_wrong_step: (x+1)(x-1)=x^2-1을 x^2+1로 전개 실수
