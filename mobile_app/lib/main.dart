import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_tts/flutter_tts.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  runApp(const SimplifySpeakApp());
}

class SimplifySpeakApp extends StatelessWidget {
  const SimplifySpeakApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Simplify & Speak',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        primaryColor: const Color(0xFF5856D6),
        scaffoldBackgroundColor: const Color(0xFF121214),
        cardColor: const Color(0xFF1C1C1E),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF5856D6),
          secondary: Color(0xFFAF52DE),
          surface: Color(0xFF1C1C1E),
        ),
      ),
      home: const SimplifySpeakHome(),
    );
  }
}

class SimplifySpeakHome extends StatefulWidget {
  const SimplifySpeakHome({super.key});

  @override
  State<SimplifySpeakHome> createState() => _SimplifySpeakHomeState();
}

class _SimplifySpeakHomeState extends State<SimplifySpeakHome> {
  final TextEditingController _textController = TextEditingController();
  final FlutterTts _flutterTts = FlutterTts();
  late StreamSubscription _intentDataStreamSubscription;
  
  String _simplifiedText = "";
  bool _isLoading = false;
  bool _isPlaying = false;
  bool _isPaused = false;
  
  // Settings variables
  String _apiProvider = "gemini";
  String _geminiKey = "";
  String _nvidiaKey = "";
  String _simplificationStyle = "standard";
  double _speechRate = 0.5; // Flutter TTS rate is between 0.0 and 1.0

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _initTts();
    _initSharingIntent();
  }

  @override
  void dispose() {
    _intentDataStreamSubscription.cancel();
    _flutterTts.stop();
    _textController.dispose();
    super.dispose();
  }

  // Load Saved Configuration
  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _apiProvider = prefs.getString("apiProvider") ?? "gemini";
      _geminiKey = prefs.getString("geminiKey") ?? "";
      _nvidiaKey = prefs.getString("nvidiaKey") ?? "";
      _simplificationStyle = prefs.getString("simplificationStyle") ?? "standard";
      _speechRate = prefs.getDouble("speechRate") ?? 0.5;
    });
  }

  // Initialize Text-To-Speech engine
  Future<void> _initTts() async {
    await _flutterTts.setLanguage("en-IN");
    await _flutterTts.setSpeechRate(_speechRate);

    _flutterTts.setStartHandler(() {
      setState(() {
        _isPlaying = true;
        _isPaused = false;
      });
    });

    _flutterTts.setCompletionHandler(() {
      setState(() {
        _isPlaying = false;
        _isPaused = false;
      });
    });

    _flutterTts.setPauseHandler(() {
      setState(() {
        _isPlaying = false;
        _isPaused = true;
      });
    });

    _flutterTts.setContinueHandler(() {
      setState(() {
        _isPlaying = true;
        _isPaused = false;
      });
    });

    _flutterTts.setErrorHandler((msg) {
      setState(() {
        _isPlaying = false;
        _isPaused = false;
      });
      _showSnackBar("TTS Error: $msg");
    });
  }

  // Initialize Share Intent handling
  void _initSharingIntent() {
    // For sharing when app is running in background
    _intentDataStreamSubscription = ReceiveSharingIntent.getTextStream().listen((String text) {
      setState(() {
        _textController.text = text;
        _simplifiedText = "";
      });
    }, onError: (err) {
      _showSnackBar("Error receiving shared text: $err");
    });

    // For sharing when app is launched fresh from share
    ReceiveSharingIntent.getInitialText().then((String? text) {
      if (text != null) {
        setState(() {
          _textController.text = text;
          _simplifiedText = "";
        });
      }
    });
  }

  Future<void> _showSnackBar(String message) async {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: const Color(0xFF1C1C1E)),
    );
  }

  // AI Simplification Routine
  Future<void> _simplifyText() async {
    final text = _textController.text.trim();
    if (text.isEmpty) {
      _showSnackBar("Please enter or share some text first!");
      return;
    }

    setState(() {
      _isLoading = true;
      _simplifiedText = "";
    });

    try {
      String systemInstruction = "Simplify the following text so it is very easy to read and understand. Keep the key information but make it concise, plain, and straightforward. Respond ONLY with the simplified text, no conversational introductions or preambles.";
      if (_simplificationStyle == "eli5") {
        systemInstruction = "Explain the following text like I'm 5 years old. Use simple analogies, very basic words, and keep it concise. Respond ONLY with the simplified text, no conversational introductions.";
      } else if (_simplificationStyle == "bullets") {
        systemInstruction = "Summarize the key takeaways of the following text into clear, simple bullet points. Respond ONLY with the bullet points, no conversational introductions or titles.";
      } else if (_simplificationStyle == "key_takeaways") {
        systemInstruction = "Extract the key takeaways of the following text in a brief, plain English paragraph. Respond ONLY with the key takeaways, no conversational introductions.";
      }

      if (_apiProvider == "nvidia") {
        if (_nvidiaKey.isEmpty) {
          throw Exception("NVIDIA NIM API key is missing. Add it in settings.");
        }

        final response = await http.post(
          Uri.parse("https://integrate.api.nvidia.com/v1/chat/completions"),
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer $_nvidiaKey"
          },
          body: jsonEncode({
            "model": "meta/llama-3.1-8b-instruct",
            "messages": [
              {"role": "system", "content": systemInstruction},
              {"role": "user", "content": text}
            ],
            "max_tokens": 1024
          })
        );

        if (response.statusCode != 200) {
          final errBody = jsonDecode(response.body);
          throw Exception(errBody['error']?['message'] ?? "NVIDIA API HTTP Error ${response.statusCode}");
        }

        final data = jsonDecode(response.body);
        setState(() {
          _simplifiedText = data['choices']?[0]?['message']?['content']?.trim() ?? "";
        });
      } else {
        // Gemini
        if (_geminiKey.isEmpty) {
          throw Exception("Gemini API key is missing. Add it in settings.");
        }

        final promptText = "$systemInstruction\n\nOriginal Text:\n$text";
        final response = await http.post(
          Uri.parse("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$_geminiKey"),
          headers: {"Content-Type": "application/json"},
          body: jsonEncode({
            "contents": [{
              "parts": [{"text": promptText}]
            }]
          })
        );

        if (response.statusCode != 200) {
          final errBody = jsonDecode(response.body);
          throw Exception(errBody['error']?['message'] ?? "Gemini API HTTP Error ${response.statusCode}");
        }

        final data = jsonDecode(response.body);
        setState(() {
          _simplifiedText = data['candidates']?[0]?['content']?['parts']?[0]?['text']?.trim() ?? "";
        });
      }

      // Automatically speak the simplified text when finished
      if (_simplifiedText.isNotEmpty) {
        _speak();
      }
    } catch (e) {
      _showSnackBar(e.toString().replaceAll("Exception: ", ""));
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  // Audio Actions
  Future<void> _speak() async {
    if (_simplifiedText.isEmpty) return;
    await _flutterTts.setSpeechRate(_speechRate);
    await _flutterTts.speak(_simplifiedText);
  }

  Future<void> _pause() async {
    await _flutterTts.pause();
  }

  Future<void> _stop() async {
    await _flutterTts.stop();
    setState(() {
      _isPlaying = false;
      _isPaused = false;
    });
  }

  // Settings Dashboard Dialog
  void _openSettingsDialog() {
    String localProvider = _apiProvider;
    final geminiController = TextEditingController(text: _geminiKey);
    final nvidiaController = TextEditingController(text: _nvidiaKey);
    String localStyle = _simplificationStyle;
    double localRate = _speechRate;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1C1C1E),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Text("✨ Configuration", style: TextStyle(fontWeight: FontWeight.bold)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Provider select
                    const Text("AI PROVIDER", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      dropdownColor: const Color(0xFF1C1C1E),
                      value: localProvider,
                      decoration: const InputDecoration(border: OutlineInputBorder()),
                      items: const [
                        DropdownMenuItem(value: "gemini", child: Text("Google Gemini")),
                        DropdownMenuItem(value: "nvidia", child: Text("NVIDIA NIM")),
                      ],
                      onChanged: (val) {
                        setDialogState(() {
                          localProvider = val!;
                        });
                      },
                    ),
                    const SizedBox(height: 16),

                    // Conditionally show Key fields
                    if (localProvider == "gemini") ...[
                      const Text("GEMINI API KEY", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
                      const SizedBox(height: 6),
                      TextField(
                        controller: geminiController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(),
                          hintText: "Enter Gemini API key",
                        ),
                      ),
                    ] else ...[
                      const Text("NVIDIA NIM API KEY", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
                      const SizedBox(height: 6),
                      TextField(
                        controller: nvidiaController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          border: OutlineInputBorder(),
                          hintText: "Enter NVIDIA NIM API key",
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),

                    // Simplification Style
                    const Text("SIMPLIFICATION LEVEL", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      dropdownColor: const Color(0xFF1C1C1E),
                      value: localStyle,
                      decoration: const InputDecoration(border: OutlineInputBorder()),
                      items: const [
                        DropdownMenuItem(value: "standard", child: Text("Standard Simple")),
                        DropdownMenuItem(value: "eli5", child: Text("Explain Like I'm 5")),
                        DropdownMenuItem(value: "bullets", child: Text("Bullet points")),
                        DropdownMenuItem(value: "key_takeaways", child: Text("Key takeaways")),
                      ],
                      onChanged: (val) {
                        setDialogState(() {
                          localStyle = val!;
                        });
                      },
                    ),
                    const SizedBox(height: 16),

                    // Speech speed rate
                    Text("SPEED RATE: ${localRate.toStringAsFixed(1)}x", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
                    Slider(
                      value: localRate,
                      min: 0.1,
                      max: 1.0,
                      divisions: 9,
                      activeColor: const Color(0xFF5856D6),
                      onChanged: (val) {
                        setDialogState(() {
                          localRate = val;
                        });
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text("Cancel", style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF5856D6),
                  ),
                  onPressed: () async {
                    final prefs = await SharedPreferences.getInstance();
                    await prefs.setString("apiProvider", localProvider);
                    await prefs.setString("geminiKey", geminiController.text.trim());
                    await prefs.setString("nvidiaKey", nvidiaController.text.trim());
                    await prefs.setString("simplificationStyle", localStyle);
                    await prefs.setDouble("speechRate", localRate);

                    setState(() {
                      _apiProvider = localProvider;
                      _geminiKey = geminiController.text.trim();
                      _nvidiaKey = nvidiaController.text.trim();
                      _simplificationStyle = localStyle;
                      _speechRate = localRate;
                    });
                    
                    _flutterTts.setSpeechRate(_speechRate);
                    if (!context.mounted) return;
                    Navigator.pop(context);
                    _showSnackBar("Settings saved!");
                  },
                  child: const Text("Save"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("✨ Simplify & Speak"),
        backgroundColor: const Color(0xFF121214),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: _openSettingsDialog,
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Original Text Input
            Expanded(
              flex: 4,
              child: Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: TextField(
                    controller: _textController,
                    maxLines: null,
                    expands: true,
                    style: const TextStyle(fontSize: 14, height: 1.4),
                    decoration: const InputDecoration(
                      hintText: "Select text on other apps and click Share to send it here, or type/paste text directly...",
                      border: InputBorder.none,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Simplify Trigger
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                backgroundColor: const Color(0xFF5856D6),
                foregroundColor: Colors.white,
              ).copyWith(
                elevation: ButtonStyleButton.allOrNull(4),
              ),
              onPressed: _isLoading ? null : _simplifyText,
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text("🔊 Simplify & Play Audio", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            ),
            const SizedBox(height: 12),

            // Simplified Output & TTS Player
            Expanded(
              flex: 5,
              child: Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF1C1C1E), Color(0xFF141416)],
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header title
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text("Simplified Text Output", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
                            if (_isPlaying)
                              Row(
                                children: [
                                  Container(
                                    width: 6,
                                    height: 6,
                                    decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle),
                                  ),
                                  const SizedBox(width: 4),
                                  const Text("Narrating", style: TextStyle(fontSize: 10, color: Colors.green)),
                                ],
                              ),
                          ],
                        ),
                      ),

                      // Text body
                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          child: Text(
                            _simplifiedText.isEmpty
                                ? "Simplified text will appear here once processed."
                                : _simplifiedText,
                            style: TextStyle(
                              fontSize: 14,
                              height: 1.5,
                              color: _simplifiedText.isEmpty ? Colors.grey : Colors.white,
                            ),
                          ),
                        ),
                      ),

                      // TTS Control Player Panel
                      if (_simplifiedText.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: const BoxDecoration(
                            border: Border(top: BorderSide(color: Colors.white10)),
                            color: Colors.black26,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              // Play / Pause
                              IconButton(
                                iconSize: 32,
                                icon: Icon(_isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled),
                                onPressed: () {
                                  if (_isPlaying) {
                                    _pause();
                                  } else {
                                    _speak();
                                  }
                                },
                              ),
                              const SizedBox(width: 12),
                              // Stop
                              IconButton(
                                iconSize: 32,
                                icon: const Icon(Icons.stop_circle),
                                onPressed: _isPlaying || _isPaused ? _stop : null,
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
