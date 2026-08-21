import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import { theme } from '@/constants/theme';

// A small decorative illustration at the top of a screen, always shown
// regardless of whether the list below it is empty or full — unlike
// EmptyState's image, which only appears while there's nothing to show.
export function PageBanner({ image }: { image: ImageSourcePropType }) {
  return (
    <View style={styles.wrap}>
      <Image source={image} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.md,
    overflow: 'hidden'
  },
  image: { width: '100%', height: 100 }
});
