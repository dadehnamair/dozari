import { StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import type { BannerSpec } from '../kit/data';
import { colors, fonts } from '../theme/colors';

/** Result ribbon: «دوزاریت افتاد!» (gold), «این دفعه نشد» (periwinkle) or «مساوی!» (lilac). */
export function Banner({ banner }: { banner: BannerSpec }) {
  return (
    <View style={[styles.ribbon, { backgroundColor: banner.base, borderTopColor: banner.light, borderBottomColor: colors.ink }]}>
      <Text style={styles.text}>{fa.kit.banners[banner.kind]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: { paddingHorizontal: 34, paddingVertical: 8, borderRadius: 18, borderWidth: 4, borderColor: colors.ink, borderTopWidth: 6, borderBottomWidth: 8, alignSelf: 'center' },
  text: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
});
