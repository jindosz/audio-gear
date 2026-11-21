package io.github.jindosz.audiogear;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 폰 EQ를 "어느 앱 소리에" 걸지 정하는 계산(안드로이드 코드가 없는 순수 자바, 단위 테스트 EqTargetingTest).
 * - 모든 앱(ALL): 폰 전체 출력(세션 0)에 건다. 전체 출력이 안 되는 폰이면 신호를 보낸 모든 앱 세션에 건다
 * - 고른 앱만(APPS): 전체 출력은 쓰지 않고, 고른 앱이 보낸 세션에만 건다
 *   (전체 출력은 모든 앱 소리가 섞인 뒤라 특정 앱만 빼거나 다르게 걸 수 없어서)
 */
public final class EqTargeting {
    public static final String ALL = "all";
    public static final String APPS = "apps";

    private EqTargeting() {}

    /** 저장된 값이 이상하면 "모든 앱"으로 본다 */
    public static String normalizeMode(String mode) {
        return APPS.equals(mode) ? APPS : ALL;
    }

    /** 전체 출력(세션 0)을 쓸지 */
    public static boolean useGlobal(String mode) {
        return !APPS.equals(normalizeMode(mode));
    }

    /**
     * 이 앱(pkg)의 세션에 EQ 효과를 붙일지.
     * globalActive: 전체 출력에 이미 걸려 있는지(그러면 앱 세션에 또 걸면 두 번 겹친다)
     */
    public static boolean wantsSession(String mode, boolean globalActive, Set<String> apps, String pkg) {
        if (APPS.equals(normalizeMode(mode))) return pkg != null && apps.contains(pkg);
        return !globalActive;
    }

    /** "a,b,c" ↔ 집합(SharedPreferences에 저장하려고). 빈 칸·중복은 뺀다 */
    public static Set<String> parseList(String text) {
        Set<String> out = new LinkedHashSet<>();
        if (text == null) return out;
        for (String part : text.split(",")) {
            String p = part.trim();
            if (!p.isEmpty()) out.add(p);
        }
        return out;
    }

    public static String joinList(Collection<String> items) {
        return String.join(",", items);
    }
}
