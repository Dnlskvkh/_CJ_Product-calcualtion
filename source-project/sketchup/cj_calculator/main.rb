# encoding: UTF-8
require 'sketchup.rb'
require 'json'
require 'base64'
require 'tempfile'
require_relative 'geometry'

module CJCalculator
  ROOT = File.dirname(__FILE__) unless const_defined?(:ROOT)

  def self.reply(dialog, id, result)
    # JSON string literal prevents names from becoming executable script.
    dialog.execute_script("CJSketchUp.receive(#{JSON.generate(id)},#{JSON.generate(result)})")
  end

  def self.show
    if @dialog && @dialog.visible?
      @dialog.bring_to_front
      return
    end
    if Sketchup.version.to_i < 24
      UI.messagebox('Для этой версии калькулятора нужен SketchUp 2024 или новее.')
      return
    end
    model = Sketchup.active_model
    dialog = UI::HtmlDialog.new(dialog_title: 'CJ · Калькулятор изделий',
      preferences_key: 'ConcreteJungle.Calculator.v1', scrollable: true,
      resizable: true, width: 1280, height: 900, min_width: 680, min_height: 560,
      style: UI::HtmlDialog::STYLE_DIALOG)
    dialog.add_action_callback('cj_request') do |_context, id, action, payload|
      begin
        raise 'Модель переключена. Закройте калькулятор и откройте его из нужной модели.' unless Sketchup.active_model == model && model.valid?
        case action
        when 'selection'
          options = JSON.parse(payload.to_s)
          result = Geometry.new(model, options).capture
        when 'save'
          data = JSON.parse(payload.to_s)
          raise 'Экспорт слишком большой (до 32 МБ).' if data['base64'].to_s.bytesize > 44_800_000
          filename = File.basename(data['name'].to_s.tr('\\', '/')).gsub(/[<>:"|?*\x00-\x1f]/, '_')[0, 180]
          raise 'Неизвестный тип файла.' unless filename.match?(/\.(json|csv|xlsx|html|txt)\z/i)
          bytes = Base64.strict_decode64(data.fetch('base64'))
          path = UI.savepanel('Сохранить файл калькулятора', nil, filename)
          if path
            # Write completely before replacing an existing export.
            temporary = Tempfile.new(['.cj-calculator-', '.tmp'], File.dirname(path))
            temporary_path = temporary.path
            begin
              temporary.binmode
              temporary.write(bytes)
              temporary.close
              File.rename(temporary_path, path)
            ensure
              temporary.close!
            end
          end
          result = { 'saved' => !path.nil? }
        else
          raise 'Неизвестная команда калькулятора.'
        end
        reply(dialog, id, { 'ok' => true, 'data' => result })
      rescue StandardError => error
        reply(dialog, id, { 'ok' => false, 'error' => error.message })
      end
    end
    dialog.set_on_closed { @dialog = nil if @dialog == dialog }
    dialog.set_file(File.join(ROOT, 'web', 'index.html'))
    @dialog = dialog
    dialog.show
  end

  unless file_loaded?(__FILE__)
    UI.menu('Extensions').add_item('CJ · Калькулятор изделий') { show }
    UI.add_context_menu_handler do |menu|
      menu.add_item('CJ · Рассчитать выделенные детали') { show } unless Sketchup.active_model.selection.empty?
    end
    file_loaded(__FILE__)
  end
end
