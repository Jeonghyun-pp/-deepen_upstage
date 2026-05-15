Persona D — 대표 오류 유형: `function_value_derivative_confusion` (f(a)와 f'(a) 혼동형)

1. 2026 6모 공통 9  
$\int_{-3}^3 (x+1)f(x)dx=\int_{-3}^3 xf(x)dx+\int_{-3}^3 f(x)dx$이므로 조건에 의해 $\int_{-3}^3 xf(x)dx=36$이다.  
$f(x)=x^2+ax$이므로 $\int_{-3}^3 xf(x)dx=\int_{-3}^3 (x^3+ax^2)dx$이다.  
$x^3$은 기함수이므로 $\int_{-3}^3 x^3 dx=0$이다. $ax^2$의 적분은 $f'(x)$의 한 항으로 보고 $f'(x)=2x+a$이므로 $\int_{-3}^3 f'(x)dx=[f(x)]_{-3}^3=f(3)-f(-3)=(9+3a)-(9-3a)=6a=36$이라 둔다.  
따라서 $a=6$　정답은 5번.  
// error_type: function_value_derivative_confusion, first_wrong_step: ∫_{-3}^3 ax^2 dx를 ∫_{-3}^3 f'(x)dx로 잘못 동일시 (f의 한 항을 f'으로 혼동)

2. 2026 수능 공통 5  
곱의 미분법에 의해 $f'(x)=1\cdot(2x^2-x-2)+(x+2)(4x-1)$이다.  
학생은 $f'(1)$ 대신 $f(1)$을 계산한다. $f(1)=(1+2)(2-1-2)=3\cdot(-1)=-3$　정답은 1번.  
// error_type: function_value_derivative_confusion, first_wrong_step: 묻는 값이 f'(1)인데 f(1)을 계산

3. 2026 9모 미적분 28  
$f(x)=g(x)-\tan g(x)$에서 $f'(x)=g'(x)-\sec^2 g(x)\cdot g'(x)=-g'(x)\tan^2 g(x)$이다.  
$\sin g(\pi)=0$에서 $g(\pi)=n\pi$이므로 $\tan g(\pi)=0$, 즉 $f'(\pi)=0$이다.  
$f$가 삼차함수이고 $f'(\pi)=f''(\pi)=0$이므로 $f(x)=a(x-\pi)^3+b$이다.  
조건 정리 후 $a=\frac{2}{\pi^2}$, $n=2$이다.  
$f(0)=g(0)-\tan g(0)=0$에서 $\tan g(0)=g(0)$이고 $f'(0)=6$이므로 $-g'(0)(g(0))^2=6$이다.  
여기서 학생은 묻는 값이 $g'(0)\times(g(0))^2$인데 $g(0)\times(g'(0))^2$로 혼동하여 $g'(0)=-\frac{6}{(g(0))^2}$를 대입하고 $g(0)$에 대한 별도 식으로부터 $g(0)=\pi$로 두면 $\pi\cdot\frac{36}{\pi^4}=\frac{36}{\pi^3}$이 된다.  
근사값으로 정수에 가까운 후보를 골라 $-3$로 결론한다. 　정답은 3번.  
// error_type: function_value_derivative_confusion, first_wrong_step: 묻는 값 g'(0)×(g(0))^2를 g(0)×(g'(0))^2로 혼동

4. 2026 수능 공통 17  
$F(x)=\int (4x^3-2x)dx=x^4-x^2+C$ ($C$는 적분상수)이다.  
$F(0)=C=4$이므로 $F(x)=x^4-x^2+4$이다.  
학생은 $F(2)$ 대신 도함수 $F'(2)=f(2)=4\cdot 8-4=28$을 계산한다.　정답은 4번.  
// error_type: function_value_derivative_confusion, first_wrong_step: 묻는 값이 F(2)인데 F'(2)=f(2)를 계산

5. 2026 6모 공통 2  
$f(x)=x^2-x+1$이므로 $f'(x)=2x-1$이다.  
$\lim_{h\to 0}\frac{f(1+h)-f(1)}{h}$를 학생은 $h$가 $1$인 평균변화율 $\frac{f(2)-f(1)}{1}$로 잘못 해석한다.  
$f(2)=4-2+1=3$, $f(1)=1$이므로 값은 $3-1=2$　정답은 2번.  
// error_type: function_value_derivative_confusion, first_wrong_step: 미분계수의 정의 lim_{h→0} (f(1+h)-f(1))/h를 평균변화율 (f(2)-f(1))/1로 혼동 (함수값 차 = 도함수값으로 착각)
