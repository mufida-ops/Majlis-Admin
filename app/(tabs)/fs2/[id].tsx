import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { showAlert } from '@/lib/alert';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { BookFileThumb } from '@/components/BookFileThumb';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { useBookCoverImage } from '@/lib/useBookCoverImage';
import {
  getBook,
  setBookCoverImage,
  removeBookCoverImage,
  listBookItemSections,
  addBookItemSection,
  deleteBookItemSection,
  addBookLink,
  addBookLinkPhoto,
  addBookLinkFile,
  deleteBookLink,
  getBookFileUrl,
  addBookBoxItem,
  deleteBookBoxItem
} from '@/lib/repositories/books';
import type { BookItemSectionRow, BookBoxType, BookLinkRow, BookBoxItemRow } from '@/types/db';

const BOX_SECTIONS: { key: BookBoxType; label: string; withPrice: boolean }[] = [
  { key: 'story', label: 'Story box items', withPrice: true },
  { key: 'cultural', label: 'Cultural box items', withPrice: true }
];

type BoxDraft = { name: string; price: string; photoUri: string | null; photoName: string; photoMime: string };
const emptyBoxDraft: BoxDraft = { name: '', price: '', photoUri: null, photoName: '', photoMime: '' };

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { workspaceId } = useWorkspace();
  const { data: book, loading, error, refresh, setData } = useAsync(() => getBook(id), [id]);
  const { data: sections, loading: sectionsLoading, setData: setSections } = useAsync(
    () => (workspaceId ? listBookItemSections(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [coverAspectRatio, setCoverAspectRatio] = useState(1 / Math.SQRT2);
  const coverImageUrl = useBookCoverImage(book?.cover_image_path);
  useEffect(() => setCoverFailed(false), [coverImageUrl]);

  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [addingLink, setAddingLink] = useState<Record<string, boolean>>({});
  const [addingPhoto, setAddingPhoto] = useState<Record<string, boolean>>({});
  const [addingDocument, setAddingDocument] = useState<Record<string, boolean>>({});
  const [boxDrafts, setBoxDrafts] = useState<Record<BookBoxType, BoxDraft>>({ story: emptyBoxDraft, cultural: emptyBoxDraft });
  const [addingBoxItem, setAddingBoxItem] = useState<Record<string, boolean>>({});
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [expandedAdd, setExpandedAdd] = useState<Record<string, boolean>>({});

  const toggleExpandedAdd = (sectionId: string) => setExpandedAdd(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));

  if (loading || sectionsLoading) return <LoadingState label="Loading book…" />;
  if (error || !book) return <ErrorState message={error ?? 'Book not found.'} onRetry={refresh} />;

  const itemSections = sections ?? [];

  const pickCoverImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo access in your phone settings to set a cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingCover(true);
    try {
      const updated = await setBookCoverImage(book.id, {
        uri: asset.uri,
        name: asset.fileName ?? 'cover.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg'
      });
      setData(prev => (prev ? { ...prev, ...updated } : prev));
    } catch (err) {
      showAlert('Could not set that cover image', err instanceof Error ? err.message : 'Try again in a moment.');
    } finally {
      setUploadingCover(false);
    }
  };

  const removeCoverImage = () => {
    showAlert('Remove cover image?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = await removeBookCoverImage(book.id);
          setData(prev => (prev ? { ...prev, ...updated } : prev));
        }
      }
    ]);
  };

  const addSection = async () => {
    if (!newSectionTitle.trim() || !workspaceId || !session) return;
    setAddingSection(true);
    try {
      const section = await addBookItemSection(workspaceId, newSectionTitle.trim(), session.user.id);
      setSections(prev => [...(prev ?? []), section]);
      setNewSectionTitle('');
    } catch (err) {
      showAlert('Could not add that section', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAddingSection(false);
    }
  };

  const removeSection = (section: BookItemSectionRow) => {
    showAlert(`Remove "${section.label}"?`, "This removes it from every book, along with any links already added under it. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSections(prev => (prev ?? []).filter(s => s.id !== section.id));
          setData(prev => (prev ? { ...prev, book_links: prev.book_links.filter(l => l.section_id !== section.id) } : prev));
          try {
            await deleteBookItemSection(section.id);
          } catch {
            refresh();
          }
        }
      }
    ]);
  };

  const setLinkDraft = (sectionId: string, value: string) => setLinkDrafts(prev => ({ ...prev, [sectionId]: value }));

  const submitLink = async (sectionId: string) => {
    const url = (linkDrafts[sectionId] ?? '').trim();
    if (!url || !workspaceId || !session) return;
    setAddingLink(prev => ({ ...prev, [sectionId]: true }));
    try {
      const link = await addBookLink({ workspace_id: workspaceId, book_id: book.id, section_id: sectionId, url, created_by: session.user.id });
      setData(prev => (prev ? { ...prev, book_links: [...prev.book_links, link] } : prev));
      setLinkDraft(sectionId, '');
      setExpandedAdd(prev => ({ ...prev, [sectionId]: false }));
    } catch (err) {
      showAlert('Could not add that link', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAddingLink(prev => ({ ...prev, [sectionId]: false }));
    }
  };

  const pickLinkPhoto = async (sectionId: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo access in your phone settings to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !workspaceId || !session) return;
    const asset = result.assets[0];
    setAddingPhoto(prev => ({ ...prev, [sectionId]: true }));
    try {
      const link = await addBookLinkPhoto(
        { workspace_id: workspaceId, book_id: book.id, section_id: sectionId, created_by: session.user.id },
        { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' }
      );
      setData(prev => (prev ? { ...prev, book_links: [...prev.book_links, link] } : prev));
      setExpandedAdd(prev => ({ ...prev, [sectionId]: false }));
    } catch (err) {
      showAlert('Could not attach that photo', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAddingPhoto(prev => ({ ...prev, [sectionId]: false }));
    }
  };

  const pickLinkDocument = async (sectionId: string) => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !workspaceId || !session) return;
    const asset = result.assets[0];
    setAddingDocument(prev => ({ ...prev, [sectionId]: true }));
    try {
      const link = await addBookLinkFile(
        { workspace_id: workspaceId, book_id: book.id, section_id: sectionId, created_by: session.user.id },
        { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' }
      );
      setData(prev => (prev ? { ...prev, book_links: [...prev.book_links, link] } : prev));
      setExpandedAdd(prev => ({ ...prev, [sectionId]: false }));
    } catch (err) {
      showAlert('Could not attach that file', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAddingDocument(prev => ({ ...prev, [sectionId]: false }));
    }
  };

  const removeLink = (link: BookLinkRow) => {
    showAlert('Remove this?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setData(prev => (prev ? { ...prev, book_links: prev.book_links.filter(l => l.id !== link.id) } : prev));
          try {
            await deleteBookLink(link.id);
          } catch {
            refresh();
          }
        }
      }
    ]);
  };

  const openLink = (link: BookLinkRow) => {
    if (link.url) Linking.openURL(link.url).catch(() => showAlert("Couldn't open that link"));
  };

  const openLinkFile = async (link: BookLinkRow) => {
    if (!link.file_path) return;
    try {
      const url = await getBookFileUrl(link.file_path);
      Linking.openURL(url).catch(() => {});
    } catch (err) {
      showAlert("Couldn't open that photo", err instanceof Error ? err.message : undefined);
    }
  };

  const updateBoxDraft = (type: BookBoxType, patch: Partial<BoxDraft>) =>
    setBoxDrafts(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const pickBoxPhoto = async (type: BookBoxType) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Photo access needed', 'Allow photo access in your phone settings to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    updateBoxDraft(type, { photoUri: asset.uri, photoName: asset.fileName ?? 'photo.jpg', photoMime: asset.mimeType ?? 'image/jpeg' });
  };

  const submitBoxItem = async (type: BookBoxType) => {
    const draft = boxDrafts[type];
    if (!draft.name.trim() || !workspaceId || !session) return;
    setAddingBoxItem(prev => ({ ...prev, [type]: true }));
    try {
      const priceNum = draft.price.trim() ? Number(draft.price.trim()) : null;
      const item = await addBookBoxItem(
        { workspace_id: workspaceId, book_id: book.id, box_type: type, name: draft.name.trim(), price: priceNum, created_by: session.user.id },
        draft.photoUri ? { uri: draft.photoUri, name: draft.photoName, mimeType: draft.photoMime } : null
      );
      setData(prev => (prev ? { ...prev, book_box_items: [...prev.book_box_items, item] } : prev));
      updateBoxDraft(type, emptyBoxDraft);
    } catch (err) {
      showAlert('Could not add that item', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setAddingBoxItem(prev => ({ ...prev, [type]: false }));
    }
  };

  const removeBoxItem = (item: BookBoxItemRow) => {
    showAlert(`Remove "${item.name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setData(prev => (prev ? { ...prev, book_box_items: prev.book_box_items.filter(i => i.id !== item.id) } : prev));
          try {
            await deleteBookBoxItem(item.id);
          } catch {
            refresh();
          }
        }
      }
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: book.title }} />

      <Pressable onPress={pickCoverImage} disabled={uploadingCover} style={styles.coverWrap}>
        {coverImageUrl && !coverFailed ? (
          <Image
            source={{ uri: coverImageUrl }}
            style={[styles.cover, { height: undefined, aspectRatio: coverAspectRatio }]}
            contentFit="contain"
            onError={() => setCoverFailed(true)}
            onLoad={event => {
              const { width, height } = event.source;
              if (width && height) setCoverAspectRatio(width / height);
            }}
          />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            {uploadingCover ? (
              <ActivityIndicator color={theme.colors.navy} />
            ) : coverImageUrl && coverFailed ? (
              <>
                <Ionicons name="alert-circle-outline" size={22} color={theme.colors.muted} />
                <Text style={styles.coverPlaceholderText}>Couldn't load that image — tap to try another</Text>
              </>
            ) : (
              <>
                <Ionicons name="image-outline" size={22} color={theme.colors.muted} />
                <Text style={styles.coverPlaceholderText}>Add a cover image</Text>
              </>
            )}
          </View>
        )}
        {coverImageUrl && !uploadingCover ? (
          <Pressable onPress={removeCoverImage} hitSlop={10} style={styles.coverRemove}>
            <Ionicons name="close-circle" size={22} color="#FFF" />
          </Pressable>
        ) : null}
      </Pressable>

      <Card style={styles.checklistCard}>
        {itemSections.map((section, index) => {
        const links = book.book_links.filter(l => l.section_id === section.id);
        return (
          <View key={section.id} style={[styles.sectionBlock, index > 0 && styles.sectionBlockDivider]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { flex: 1 }]}>{section.label}</Text>
              <Pressable hitSlop={10} onPress={() => toggleExpandedAdd(section.id)}>
                <Ionicons
                  name={expandedAdd[section.id] ? 'remove-circle-outline' : 'add-circle-outline'}
                  size={20}
                  color={theme.colors.navy}
                />
              </Pressable>
              <Pressable hitSlop={10} onPress={() => removeSection(section)} style={{ marginLeft: 14 }}>
                <Ionicons name="trash-outline" size={16} color={theme.colors.muted} />
              </Pressable>
            </View>
            {links.length === 0 && !expandedAdd[section.id] ? <Text style={styles.meta}>Nothing added yet.</Text> : null}
            {links.map(link => (
              <View key={link.id} style={styles.linkRow}>
                {link.file_path && link.label ? (
                  <Pressable style={styles.linkTapArea} onPress={() => openLinkFile(link)}>
                    <Ionicons name="document-attach-outline" size={20} color={theme.colors.navy} />
                    <Text style={styles.linkText} numberOfLines={1}>{link.label}</Text>
                  </Pressable>
                ) : link.file_path ? (
                  <Pressable style={styles.linkTapArea} onPress={() => openLinkFile(link)}>
                    <BookFileThumb storagePath={link.file_path} />
                    <Text style={styles.linkText} numberOfLines={1}>Photo</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.linkTapArea} onPress={() => openLink(link)}>
                    {link.preview_image_url ? (
                      <Image source={{ uri: link.preview_image_url }} style={styles.linkThumb} contentFit="cover" />
                    ) : (
                      <Ionicons name="link-outline" size={18} color={theme.colors.navy} />
                    )}
                    <Text style={styles.linkText} numberOfLines={1}>{link.url}</Text>
                  </Pressable>
                )}
                <Pressable hitSlop={10} onPress={() => removeLink(link)}>
                  <Ionicons name="close-circle-outline" size={20} color={theme.colors.muted} />
                </Pressable>
              </View>
            ))}
            {expandedAdd[section.id] ? (
              <View style={styles.addLinkRow}>
                <TextInput
                  value={linkDrafts[section.id] ?? ''}
                  onChangeText={v => setLinkDraft(section.id, v)}
                  placeholder="Paste a Canva link…"
                  placeholderTextColor={theme.colors.muted}
                  style={[styles.input, { flex: 1 }]}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <Pressable
                  style={styles.smallButton}
                  onPress={() => submitLink(section.id)}
                  disabled={!!addingLink[section.id] || !(linkDrafts[section.id] ?? '').trim()}
                >
                  <Text style={styles.smallButtonText}>{addingLink[section.id] ? '…' : 'Add'}</Text>
                </Pressable>
                <Pressable style={styles.photoButton} onPress={() => pickLinkPhoto(section.id)} disabled={!!addingPhoto[section.id]}>
                  {addingPhoto[section.id] ? (
                    <ActivityIndicator size="small" color={theme.colors.navy} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={theme.colors.navy} />
                  )}
                </Pressable>
                <Pressable style={styles.photoButton} onPress={() => pickLinkDocument(section.id)} disabled={!!addingDocument[section.id]}>
                  {addingDocument[section.id] ? (
                    <ActivityIndicator size="small" color={theme.colors.navy} />
                  ) : (
                    <Ionicons name="document-attach-outline" size={20} color={theme.colors.navy} />
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        );
        })}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Add a section</Text>
        <Text style={styles.meta}>Adds a new checklist item to every book, not just this one.</Text>
        <View style={styles.addLinkRow}>
          <TextInput
            value={newSectionTitle}
            onChangeText={setNewSectionTitle}
            placeholder="e.g. Story map"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable style={styles.smallButton} onPress={addSection} disabled={addingSection || !newSectionTitle.trim()}>
            <Text style={styles.smallButtonText}>{addingSection ? '…' : 'Add'}</Text>
          </Pressable>
        </View>
      </Card>

      {BOX_SECTIONS.map(section => {
        const items = book.book_box_items.filter(i => i.box_type === section.key);
        const draft = boxDrafts[section.key];
        return (
          <Card key={section.key}>
            <Text style={styles.sectionTitle}>{section.label}</Text>
            {items.length === 0 ? <Text style={styles.meta}>Nothing added yet.</Text> : null}
            {items.map(item => (
              <View key={item.id} style={styles.boxItemRow}>
                {item.image_path ? <BookFileThumb storagePath={item.image_path} /> : <View style={styles.boxItemNoPhoto} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkText}>{item.name}</Text>
                  {item.price != null ? <Text style={styles.meta}>AED {item.price}</Text> : null}
                </View>
                <Pressable hitSlop={10} onPress={() => removeBoxItem(item)}>
                  <Ionicons name="close-circle-outline" size={20} color={theme.colors.muted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.boxAddForm}>
              <View style={styles.addLinkRow}>
                <TextInput
                  value={draft.name}
                  onChangeText={v => updateBoxDraft(section.key, { name: v })}
                  placeholder="Item name"
                  placeholderTextColor={theme.colors.muted}
                  style={[styles.input, { flex: 1 }]}
                />
                {section.withPrice ? (
                  <TextInput
                    value={draft.price}
                    onChangeText={v => updateBoxDraft(section.key, { price: v })}
                    placeholder="Price"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, { width: 80 }]}
                    keyboardType="decimal-pad"
                  />
                ) : null}
              </View>
              <View style={styles.addLinkRow}>
                <Pressable style={styles.photoButton} onPress={() => pickBoxPhoto(section.key)}>
                  {draft.photoUri ? (
                    <Image source={{ uri: draft.photoUri }} style={styles.pendingPhotoPreview} contentFit="cover" />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={theme.colors.navy} />
                  )}
                </Pressable>
                <Pressable
                  style={[styles.smallButton, { flex: 1 }]}
                  onPress={() => submitBoxItem(section.key)}
                  disabled={!!addingBoxItem[section.key] || !draft.name.trim()}
                >
                  <Text style={styles.smallButtonText}>{addingBoxItem[section.key] ? 'Adding…' : '+ Add item'}</Text>
                </Pressable>
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverWrap: { borderRadius: theme.radius.md, overflow: 'hidden' },
  cover: { width: '100%', height: 160 },
  coverPlaceholder: {
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    gap: 6
  },
  coverPlaceholderText: { color: theme.colors.muted, fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  coverRemove: { position: 'absolute', top: 8, right: 8 },
  checklistCard: { padding: 0, overflow: 'hidden' },
  sectionBlock: { padding: 16 },
  sectionBlockDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 6 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  linkTapArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkThumb: { width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted },
  linkText: { color: theme.colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  addLinkRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  input: {
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  smallButton: { backgroundColor: theme.colors.navy, borderRadius: theme.radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  smallButtonText: { color: '#fff', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  photoButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  pendingPhotoPreview: { width: '100%', height: '100%' },
  boxItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  boxItemNoPhoto: { width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted },
  boxAddForm: { marginTop: 12, gap: 8 }
});
