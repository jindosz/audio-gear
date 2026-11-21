package io.github.jindosz.audiogear;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Set;
import org.junit.Test;

/** EqTargeting(폰 EQ를 어느 앱에 걸지) 테스트. GitHub 빌드에서 ./gradlew testReleaseUnitTest로 돈다 */
public class EqTargetingTest {
    private final Set<String> spotify = EqTargeting.parseList("com.spotify.music");

    @Test
    public void allMode_usesGlobal_andSessionsOnlyAsFallback() {
        assertTrue(EqTargeting.useGlobal("all"));
        assertFalse(EqTargeting.wantsSession("all", true, spotify, "com.spotify.music"));
        assertTrue(EqTargeting.wantsSession("all", false, spotify, "com.google.android.apps.youtube.music"));
    }

    @Test
    public void appsMode_onlyChosenApps_neverGlobal() {
        assertFalse(EqTargeting.useGlobal("apps"));
        assertTrue(EqTargeting.wantsSession("apps", false, spotify, "com.spotify.music"));
        assertFalse(EqTargeting.wantsSession("apps", false, spotify, "com.apple.android.music"));
        assertFalse(EqTargeting.wantsSession("apps", false, spotify, null));
    }

    @Test
    public void unknownMode_isAll() {
        assertEquals("all", EqTargeting.normalizeMode(null));
        assertEquals("all", EqTargeting.normalizeMode("weird"));
    }

    @Test
    public void listRoundTrip_dropsBlanksAndDuplicates() {
        Set<String> set = EqTargeting.parseList(" a, b,,a ,");
        assertEquals(Arrays.asList("a", "b"), new java.util.ArrayList<>(set));
        assertEquals("a,b", EqTargeting.joinList(set));
        assertTrue(EqTargeting.parseList(null).isEmpty());
    }
}
